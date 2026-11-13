import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres"
import { Client, Pool, type QueryResultRow } from "pg"
import { eq } from "drizzle-orm"
import { eventTickets } from "../lib/db/schema"
import { admitTicket, EventError, issueTickets, revokeTickets } from "../lib/event-ticket-service"
import { getTicketSigningKey, ticketCode, verifyTicketCode } from "../lib/event-ticket-code"
import { hasPermission, canAccessAdmin } from "../lib/rbac/permissions"
import { validEventWindow } from "../lib/event-product-validation"

test("تذاكر الفعاليات: التوقيع والدفع والصلاحيات والتزامن", async (t) => {
  const previousKey = process.env.EVENT_TICKET_SECRET
  process.env.EVENT_TICKET_SECRET = randomBytes(32).toString("hex")
  const databaseUrl = process.env.TEST_EVENTS_DATABASE_URL
  const isolatedSchema = `event_ticket_test_${randomBytes(8).toString("hex")}`
  const cleanupClient = databaseUrl ? new Client({ connectionString: databaseUrl }) : null
  let pool: Pool | null = null
  let embedded: PGlite | null = null
  if (cleanupClient) {
    await cleanupClient.connect()
    await cleanupClient.query(`CREATE SCHEMA "${isolatedSchema}"`)
    pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${isolatedSchema}`, max: 4 })
  } else {
    embedded = new PGlite()
  }
  const pg = (pool ? {
    exec: async (query: string) => pool!.query(query),
    query: async <T extends QueryResultRow>(query: string, params?: unknown[]) => pool!.query<T>(query, params),
  } : embedded!) as {
    exec: (query: string) => Promise<unknown>
    query: <T extends QueryResultRow = Record<string, unknown>>(query: string, params?: unknown[]) => Promise<{ rows: T[] }>
  }
  const connection = pool ? drizzlePostgres(pool) : drizzle(embedded!)
  const admin = randomUUID(), staff = randomUUID(), buyer = randomUUID(), otherStaff = randomUUID()
  const product = randomUUID(), otherProduct = randomUUID(), order = randomUUID(), item = randomUUID()
  try {
    await pg.exec(`
      CREATE TYPE role AS ENUM ('student','instructor','admin','manager','support');
      CREATE TABLE users (id UUID PRIMARY KEY, name TEXT NOT NULL, role role NOT NULL, is_active BOOLEAN DEFAULT true);
      CREATE TABLE products (id UUID PRIMARY KEY, name_ar TEXT, name_en TEXT, is_active BOOLEAN DEFAULT true, stock_quantity INTEGER DEFAULT 20);
      CREATE TABLE orders (id UUID PRIMARY KEY, user_id UUID REFERENCES users(id), status TEXT, payment_provider TEXT, paid_at TIMESTAMP);
      CREATE TABLE order_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID REFERENCES orders(id), product_id UUID REFERENCES products(id), quantity INTEGER);
      CREATE TABLE audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), action TEXT, resource TEXT, resource_id UUID, changes JSONB, created_at TIMESTAMP DEFAULT NOW());
    `)
    const migration = readFileSync(new URL("../lib/db/migrations/0011_add_event_tickets.sql", import.meta.url), "utf8").split("--> statement-breakpoint")
    await pg.exec(migration[0])
    await pg.exec(migration[1])
    for (const [id, role, name] of [[admin, "admin", "Admin"], [staff, "event_staff", "Gate"], [buyer, "student", "Buyer"], [otherStaff, "event_staff", "Other gate"]]) {
      await pg.query("INSERT INTO users (id, role, name) VALUES ($1,$2,$3)", [id, role, name])
    }
    for (const id of [product, otherProduct]) {
      await pg.query("INSERT INTO products (id, product_type, event_starts_at, event_ends_at, event_location) VALUES ($1,'event_ticket',NOW() - INTERVAL '1 hour', NOW() + INTERVAL '1 hour','Hall')", [id])
    }
    await pg.query("INSERT INTO event_staff_assignments (product_id,user_id,assigned_by) VALUES ($1,$2,$3)", [product, staff, admin])
    await pg.query("INSERT INTO orders VALUES ($1,$2,'paid','stream',NOW())", [order, buyer])
    await pg.query("INSERT INTO order_items (id,order_id,product_id,quantity) VALUES ($1,$2,$3,3)", [item, order, product])
    const tickets = async () => connection.select().from(eventTickets).where(eq(eventTickets.orderItemId, item))
    const rejectsCode = async (operation: Promise<unknown>, expected: string) => assert.rejects(operation, (e: unknown) => e instanceof EventError && e.code === expected)

    await t.test("إصدار تذكرة لكل وحدة وإعادة التنفيذ دون تكرار", async () => {
      await Promise.all([issueTickets(connection, order), issueTickets(connection, order)])
      assert.equal((await tickets()).length, 3)
    })
    const [first, second, third] = (await tickets()).sort((a, b) => a.ordinal - b.ordinal)
    const firstCode = ticketCode(first)

    await t.test("توقيع غير قابل للتعديل أو نقل الملكية", () => {
      assert(verifyTicketCode(firstCode, first))
      assert(!verifyTicketCode(`${firstCode.slice(0, -1)}${firstCode.endsWith("0") ? "1" : "0"}`, first))
      assert(!verifyTicketCode(firstCode, { ...first, userId: admin }))
      assert(!verifyTicketCode(firstCode, first, randomBytes(32).toString("hex")))
      assert(!firstCode.includes(buyer))
    })
    await t.test("دور الموظف محدود وليس دور أدمن", () => {
      assert(hasPermission("event_staff", "events:checkin"))
      assert(!hasPermission("event_staff", "users:write"))
      assert(!hasPermission("event_staff", "orders:write"))
      assert(!canAccessAdmin("event_staff"))
    })
    await t.test("رفض الطالب والموظف غير المعيّن والفعالية الخاطئة", async () => {
      await rejectsCode(admitTicket(connection, buyer, product, firstCode), "FORBIDDEN")
      await rejectsCode(admitTicket(connection, otherStaff, product, firstCode), "FORBIDDEN")
      await rejectsCode(admitTicket(connection, staff, otherProduct, firstCode), "FORBIDDEN")
      await rejectsCode(admitTicket(connection, admin, otherProduct, firstCode), "INVALID_TICKET")
    })
    await t.test("رفض الرمز المعدل مع تسجيل المحاولة", async () => {
      await rejectsCode(admitTicket(connection, staff, product, firstCode.replace("NEVT1", "NEVT2")), "INVALID_TICKET")
      const logs = await pg.query<{ count: number }>("SELECT count(*)::int AS count FROM audit_logs WHERE action='event_scan_rejected'")
      assert(logs.rows[0].count >= 1)
    })
    await t.test("مسح متزامن من جهازين يقبل مرة واحدة فقط", async () => {
      const outcomes = await Promise.allSettled([
        admitTicket(connection, staff, product, firstCode),
        admitTicket(connection, admin, product, firstCode),
      ])
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1)
      const logs = await pg.query<{ count: number }>("SELECT count(*)::int AS count FROM audit_logs WHERE action='event_check_in' AND resource_id=$1", [first.id])
      assert.equal(logs.rows[0].count, 1)
      await rejectsCode(admitTicket(connection, staff, product, firstCode), "ALREADY_CHECKED_IN")
    })
    await t.test("سحب التعيين وتغيير الدور وتعطيل الموظف يمنع الدخول فوراً", async () => {
      await pg.query("DELETE FROM event_staff_assignments WHERE user_id=$1", [staff])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "FORBIDDEN")
      await pg.query("INSERT INTO event_staff_assignments (product_id,user_id,assigned_by) VALUES ($1,$2,$3)", [product, staff, admin])
      await pg.query("UPDATE users SET role='student' WHERE id=$1", [staff])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "FORBIDDEN")
      await pg.query("UPDATE users SET role='event_staff', is_active=false WHERE id=$1", [staff])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "FORBIDDEN")
      await pg.query("UPDATE users SET is_active=true WHERE id=$1", [staff])
    })
    await t.test("رفض الدخول قبل النافذة وبعدها وعند تعطيل الفعالية", async () => {
      await pg.query("UPDATE products SET event_starts_at=NOW()+INTERVAL '10 minutes' WHERE id=$1", [product])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "NOT_ADMISSIBLE")
      await pg.query("UPDATE products SET event_starts_at=NOW()-INTERVAL '1 hour',event_ends_at=NOW()-INTERVAL '1 minute' WHERE id=$1", [product])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "NOT_ADMISSIBLE")
      await pg.query("UPDATE products SET event_ends_at=NOW()+INTERVAL '1 hour',is_active=false WHERE id=$1", [product])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "NOT_ADMISSIBLE")
      await pg.query("UPDATE products SET is_active=true WHERE id=$1", [product])
    })
    await t.test("الدفع المعلق لا يسمح بالدخول أو إصدار تذاكر إضافية", async () => {
      await pg.query("UPDATE orders SET status='pending' WHERE id=$1", [order])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "NOT_ADMISSIBLE")
      await issueTickets(connection, order)
      assert.equal((await tickets()).length, 3)
      await pg.query("UPDATE orders SET status='paid' WHERE id=$1", [order])
    })
    await t.test("تعطيل صاحب التذكرة يمنع الدخول", async () => {
      await pg.query("UPDATE users SET is_active=false WHERE id=$1", [buyer])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "NOT_ADMISSIBLE")
      await pg.query("UPDATE users SET is_active=true WHERE id=$1", [buyer])
    })
    await t.test("فشل سجل التدقيق يتراجع عن تسجيل الحضور", async () => {
      await pg.exec("ALTER TABLE audit_logs RENAME TO audit_logs_saved")
      await assert.rejects(admitTicket(connection, staff, product, ticketCode(second)))
      assert.equal((await tickets()).find((ticket) => ticket.id === second.id)?.checkedInAt, null)
      await pg.exec("ALTER TABLE audit_logs_saved RENAME TO audit_logs")
    })
    await t.test("التذكرة الملغاة تبقى ملغاة بعد إعادة الإصدار", async () => {
      await revokeTickets(connection, order)
      await issueTickets(connection, order)
      assert.equal((await tickets()).length, 3)
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(third)), "NOT_ADMISSIBLE")
    })
    await t.test("منع تجاوز السعة ورفض المسار اليدوي للتذاكر", async () => {
      const pending = randomUUID()
      await pg.query("INSERT INTO orders VALUES ($1,$2,'pending','stream',NULL)", [pending, buyer])
      await assert.rejects(pg.query("INSERT INTO order_items (order_id,product_id,quantity) VALUES ($1,$2,21)", [pending, product]), /capacity exceeded/)
      await pg.query("UPDATE orders SET payment_provider='manual' WHERE id=$1", [pending])
      await assert.rejects(pg.query("INSERT INTO order_items (order_id,product_id,quantity) VALUES ($1,$2,1)", [pending, product]), /not allowed/)
    })
    await t.test("حجز آخر مقعد متزامن لا يتجاوز سعة الفعالية", async () => {
      await pg.query("UPDATE products SET stock_quantity=1 WHERE id=$1", [otherProduct])
      const firstOrder = randomUUID(), secondOrder = randomUUID()
      await pg.query("INSERT INTO orders VALUES ($1,$3,'pending','stream',NULL),($2,$3,'pending','stream',NULL)", [firstOrder, secondOrder, buyer])
      const results = await Promise.allSettled([
        pg.query("INSERT INTO order_items (order_id,product_id,quantity) VALUES ($1,$2,1)", [firstOrder, otherProduct]),
        pg.query("INSERT INTO order_items (order_id,product_id,quantity) VALUES ($1,$2,1)", [secondOrder, otherProduct]),
      ])
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
    })
    await t.test("حد المحاولات محفوظ في قاعدة البيانات", async () => {
      await pg.query("UPDATE event_scan_limits SET attempts=60,window_starts_at=date_trunc('minute',NOW()) WHERE user_id=$1", [staff])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(third)), "RATE_LIMITED")
    })
    await t.test("التحقق من إعدادات الفعالية والمفتاح الضعيف", () => {
      assert(!validEventWindow({ productType: "event_ticket", eventLocation: "Hall" }))
      assert(!validEventWindow({ productType: "event_ticket", eventLocation: "Hall", eventStartsAt: "2026-01-02", eventEndsAt: "2026-01-01" }))
      process.env.EVENT_TICKET_SECRET = "weak"
      assert.throws(() => getTicketSigningKey())
    })
  } finally {
    if (previousKey === undefined) delete process.env.EVENT_TICKET_SECRET
    else process.env.EVENT_TICKET_SECRET = previousKey
    if (embedded) await embedded.close()
    if (pool) await pool.end()
    if (cleanupClient) {
      await cleanupClient.query(`DROP SCHEMA "${isolatedSchema}" CASCADE`)
      await cleanupClient.end()
    }
  }
})
