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

test("ترقيم التذاكر السابقة ثابت ويحافظ على الباركود عند تحديث قاعدة البيانات", async () => {
  const pg = new PGlite()
  const product = randomUUID(), userId = randomUUID(), firstItem = randomUUID(), secondItem = randomUUID()
  const id = randomUUID()
  try {
    await pg.exec(`
      CREATE TABLE products (id UUID PRIMARY KEY);
      CREATE TABLE event_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), product_id UUID REFERENCES products(id),
        order_item_id UUID, user_id UUID, ordinal INTEGER, created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (order_item_id, ordinal)
      );
    `)
    await pg.query("INSERT INTO products VALUES ($1)", [product])
    await pg.query(`INSERT INTO event_tickets (id,product_id,order_item_id,user_id,ordinal,created_at)
      VALUES ($1,$2,$3,$5,1,NOW()-INTERVAL '1 day'),($6,$2,$4,$5,1,NOW()),
      ($7,$2,$3,$5,2,NOW()-INTERVAL '1 day')`, [id, product, firstItem, secondItem, userId, randomUUID(), randomUUID()])
    const identity = { id, productId: product, orderItemId: firstItem, userId, ordinal: 1 }
    const secret = "ticket-number-test-secret-with-at-least-32-characters"
    const code = ticketCode(identity, secret)
    const migration = readFileSync(new URL("../lib/db/migrations/0014_add_event_ticket_numbers.sql", import.meta.url), "utf8")
    await pg.exec(`BEGIN; ${migration} COMMIT;`)
    const first = await pg.query<{ id: string; ticket_number: number }>("SELECT id,ticket_number FROM event_tickets ORDER BY ticket_number")
    assert.deepEqual(first.rows.map((ticket) => ticket.ticket_number), [1, 2, 3])
    assert.equal(first.rows[0].id, id)
    await pg.exec(`BEGIN; ${migration} COMMIT;`)
    const again = await pg.query<{ id: string; ticket_number: number }>("SELECT id,ticket_number FROM event_tickets ORDER BY ticket_number")
    assert.deepEqual(again.rows, first.rows)
    assert(verifyTicketCode(code, { ...identity, ticketNumber: 1 } as typeof identity, secret))
  } finally { await pg.close() }
})

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
      CREATE TABLE cart_items (id UUID PRIMARY KEY);
    `)
    const migration = readFileSync(new URL("../lib/db/migrations/0011_add_event_tickets.sql", import.meta.url), "utf8").split("--> statement-breakpoint")
    await pg.exec(migration[0])
    await pg.exec(migration[1])
    const numberingMigration = readFileSync(new URL("../lib/db/migrations/0014_add_event_ticket_numbers.sql", import.meta.url), "utf8")
    await pg.exec(`BEGIN; ${numberingMigration} COMMIT;`)
    await pg.exec(readFileSync(new URL("../lib/db/migrations/0015_add_event_add_ons.sql", import.meta.url), "utf8"))
    for (const [id, role, name] of [[admin, "admin", "Admin"], [staff, "event_staff", "Gate"], [buyer, "student", "Buyer"], [otherStaff, "event_staff", "Other gate"]]) {
      await pg.query("INSERT INTO users (id, role, name) VALUES ($1,$2,$3)", [id, role, name])
    }
    for (const id of [product, otherProduct]) {
      await pg.query("INSERT INTO products (id, product_type, event_starts_at, event_ends_at, event_location) VALUES ($1,'event_ticket',NOW() - INTERVAL '1 hour', NOW() + INTERVAL '1 hour','Hall')", [id])
    }
    await pg.query("INSERT INTO event_staff_assignments (product_id,user_id,assigned_by) VALUES ($1,$2,$3)", [product, staff, admin])
    await pg.query("INSERT INTO orders VALUES ($1,$2,'paid','stream',NOW())", [order, buyer])
    await pg.query("INSERT INTO order_items (id,order_id,product_id,quantity) VALUES ($1,$2,$3,3)", [item, order, product])
    const dinner = [
      { id: randomUUID(), nameAr: "وجبة عشاء", nameEn: "Dinner", price: "25.00", noteAr: "وجبة لشخص واحد", noteEn: "One meal" },
      { id: randomUUID(), nameAr: "تذكرة حضور", nameEn: "Attendance", price: "0.00", noteAr: "دون عشاء" },
    ]
    await pg.query("UPDATE order_items SET selected_add_ons=$1::jsonb WHERE id=$2", [JSON.stringify(dinner), item])
    const tickets = async () => connection.select().from(eventTickets).where(eq(eventTickets.orderItemId, item))
    const rejectsCode = async (operation: Promise<unknown>, expected: string) => assert.rejects(operation, (e: unknown) => e instanceof EventError && e.code === expected)

    await t.test("إصدار تذكرة لكل وحدة وإعادة التنفيذ دون تكرار", async () => {
      await Promise.all([issueTickets(connection, order), issueTickets(connection, order)])
      assert.equal((await tickets()).length, 3)
      assert.deepEqual((await tickets()).map((ticket) => ticket.ticketNumber).sort((a, b) => a - b), [1, 2, 3])
      const counter = await pg.query<{ last_number: number }>("SELECT last_number FROM event_ticket_counters WHERE product_id=$1", [product])
      assert.equal(counter.rows[0].last_number, 3)
    })
    const [first, second, third] = (await tickets()).sort((a, b) => a.ordinal - b.ordinal)
    const firstCode = ticketCode(first)

    await t.test("رقم التذكرة يستمر عبر الطلبات والحسابات ولا يعاد إلى واحد", async () => {
      const nextBuyer = randomUUID(), nextOrder = randomUUID(), nextItem = randomUUID()
      await pg.query("INSERT INTO users (id,role,name) VALUES ($1,'student','Next buyer')", [nextBuyer])
      await pg.query("INSERT INTO orders VALUES ($1,$2,'paid','stream',NOW())", [nextOrder, nextBuyer])
      await pg.query("INSERT INTO order_items (id,order_id,product_id,quantity) VALUES ($1,$2,$3,2)", [nextItem, nextOrder, product])
      await Promise.all([issueTickets(connection, nextOrder), issueTickets(connection, nextOrder)])
      const next = await connection.select().from(eventTickets).where(eq(eventTickets.orderItemId, nextItem))
      assert.deepEqual(next.map((ticket) => ticket.ticketNumber).sort((a, b) => a - b), [4, 5])
      assert.deepEqual(next.map((ticket) => ticket.ordinal).sort((a, b) => a - b), [1, 2])
      const before = ticketCode(next[0])
      await pg.exec(`BEGIN; ${numberingMigration} COMMIT;`)
      const refreshed = await connection.select().from(eventTickets).where(eq(eventTickets.id, next[0].id))
      assert.equal(refreshed[0].ticketNumber, next[0].ticketNumber)
      assert.equal(ticketCode(refreshed[0]), before)
    })
    await t.test("إصدار طلبين مختلفين بالتزامن يعطي أرقاما فريدة ومتتابعة", async () => {
      const ids = [randomUUID(), randomUUID()]
      for (const id of ids) {
        await pg.query("INSERT INTO orders VALUES ($1,$2,'paid','stream',NOW())", [id, buyer])
        await pg.query("INSERT INTO order_items (order_id,product_id,quantity) VALUES ($1,$2,1)", [id, product])
      }
      await Promise.all(ids.map((id) => issueTickets(connection, id)))
      const numbered = await pg.query<{ ticket_number: number }>("SELECT ticket_number FROM event_tickets WHERE product_id=$1 ORDER BY ticket_number", [product])
      assert.deepEqual(numbered.rows.map((ticket) => ticket.ticket_number), [1, 2, 3, 4, 5, 6, 7])
    })
    await t.test("لكل فعالية عداد مستقل ولا يعاد استخدام رقم تذكرة محذوفة", async () => {
      const anotherEvent = randomUUID(), anotherOrder = randomUUID(), anotherItem = randomUUID()
      await pg.query("INSERT INTO products (id,product_type,event_starts_at,event_ends_at,event_location) VALUES ($1,'event_ticket',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour','Hall')", [anotherEvent])
      await pg.query("INSERT INTO orders VALUES ($1,$2,'paid','stream',NOW())", [anotherOrder, buyer])
      await pg.query("INSERT INTO order_items (id,order_id,product_id,quantity) VALUES ($1,$2,$3,1)", [anotherItem, anotherOrder, anotherEvent])
      await issueTickets(connection, anotherOrder)
      let fresh = await connection.select().from(eventTickets).where(eq(eventTickets.orderItemId, anotherItem))
      assert.equal(fresh[0].ticketNumber, 1)
      await pg.query("DELETE FROM event_tickets WHERE id=$1", [fresh[0].id])
      await issueTickets(connection, anotherOrder)
      fresh = await connection.select().from(eventTickets).where(eq(eventTickets.orderItemId, anotherItem))
      assert.equal(fresh[0].ticketNumber, 2)
    })
    await t.test("فشل إصدار تذكرة لا يستهلك الرقم التالي", async () => {
      await assert.rejects(pg.query("INSERT INTO event_tickets (order_item_id,product_id,user_id,ordinal) VALUES ($1,$2,$3,0)", [item, product, buyer]))
      const counter = await pg.query<{ last_number: number }>("SELECT last_number FROM event_ticket_counters WHERE product_id=$1", [product])
      assert.equal(counter.rows[0].last_number, 7)
    })
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
      await pg.query("UPDATE products SET event_add_ons=$1::jsonb WHERE id=$2", [
        JSON.stringify([{ ...dinner[0], nameAr: "خيار جديد", noteAr: "ملاحظة جديدة", price: "99.00" }]), product,
      ])
      const outcomes = await Promise.allSettled([
        admitTicket(connection, staff, product, firstCode),
        admitTicket(connection, admin, product, firstCode),
      ])
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1)
      const accepted = outcomes.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>
      assert.deepEqual(accepted.value.addOns, dinner)
      assert.equal(accepted.value.ticketNumber, first.ticketNumber)
      const logs = await pg.query<{ count: number }>("SELECT count(*)::int AS count FROM audit_logs WHERE action='event_check_in' AND resource_id=$1", [first.id])
      assert.equal(logs.rows[0].count, 1)
      await rejectsCode(admitTicket(connection, staff, product, firstCode), "ALREADY_CHECKED_IN")
    })
    await t.test("المسح المتكرر يعرض المزايا ووقت الدخول الأصلي دون تسجيل حضور إضافي", async () => {
      const before = (await tickets()).find((ticket) => ticket.id === first.id)!
      for (const userId of [staff, admin]) {
        await assert.rejects(admitTicket(connection, userId, product, firstCode), (error: unknown) => {
          assert(error instanceof EventError)
          assert.equal(error.code, "ALREADY_CHECKED_IN")
          assert.equal(error.status, 409)
          assert.equal(error.details?.attendeeName, "Buyer")
          assert.equal(error.details?.id, first.id)
          assert.equal(error.details?.ticketNumber, first.ticketNumber)
          assert.deepEqual(error.details?.addOns, dinner)
          assert.equal(new Date(error.details!.checkedInAt).getTime(), before.checkedInAt!.getTime())
          assert.deepEqual(Object.keys(error.details!).sort(), ["addOns", "attendeeName", "checkedInAt", "id", "ticketNumber"])
          return true
        })
      }
      const after = (await tickets()).find((ticket) => ticket.id === first.id)!
      assert.equal(after.checkedInAt!.getTime(), before.checkedInAt!.getTime())
      assert.equal(after.checkedInBy, before.checkedInBy)
      const logs = await pg.query<{ count: number }>("SELECT count(*)::int AS count FROM audit_logs WHERE action='event_check_in' AND resource_id=$1", [first.id])
      assert.equal(logs.rows[0].count, 1)
      await assert.rejects(admitTicket(connection, otherStaff, product, firstCode), (error: unknown) =>
        error instanceof EventError && error.code === "FORBIDDEN" && error.details === undefined)
      await assert.rejects(admitTicket(connection, staff, product, firstCode.replace("NEVT1", "NEVT2")), (error: unknown) =>
        error instanceof EventError && error.code === "INVALID_TICKET" && error.details === undefined)
    })
    await t.test("سحب التعيين وتغيير الدور وتعطيل الموظف يمنع الدخول فوراً", async () => {
      await pg.query("DELETE FROM event_staff_assignments WHERE user_id=$1", [staff])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "FORBIDDEN")
      await assert.rejects(admitTicket(connection, staff, product, firstCode), (error: unknown) =>
        error instanceof EventError && error.code === "FORBIDDEN" && error.details === undefined)
      await pg.query("INSERT INTO event_staff_assignments (product_id,user_id,assigned_by) VALUES ($1,$2,$3)", [product, staff, admin])
      await pg.query("UPDATE users SET role='student' WHERE id=$1", [staff])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "FORBIDDEN")
      await pg.query("UPDATE users SET role='event_staff', is_active=false WHERE id=$1", [staff])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "FORBIDDEN")
      await pg.query("UPDATE users SET is_active=true WHERE id=$1", [staff])
    })
    await t.test("قبول المسح قبل الفعالية وبعدها مع منع الاستخدام الثاني", async () => {
      const anytimeOrder = randomUUID(), anytimeItem = randomUUID()
      await pg.query("INSERT INTO orders VALUES ($1,$2,'paid','stream',NOW())", [anytimeOrder, buyer])
      await pg.query("INSERT INTO order_items (id,order_id,product_id,quantity) VALUES ($1,$2,$3,2)", [anytimeItem, anytimeOrder, product])
      await issueTickets(connection, anytimeOrder)
      const anytime = await connection.select().from(eventTickets).where(eq(eventTickets.orderItemId, anytimeItem))
      await pg.query("UPDATE products SET event_starts_at=NOW()+INTERVAL '1 day',event_ends_at=NOW()+INTERVAL '2 days' WHERE id=$1", [product])
      const before = await admitTicket(connection, staff, product, ticketCode(anytime[0]))
      assert.equal(before.id, anytime[0].id)
      assert(before.checkedInAt)
      await rejectsCode(admitTicket(connection, admin, product, ticketCode(anytime[0])), "ALREADY_CHECKED_IN")
      await pg.query("UPDATE products SET event_starts_at=NOW()-INTERVAL '2 days',event_ends_at=NOW()-INTERVAL '1 day' WHERE id=$1", [product])
      const after = await admitTicket(connection, admin, product, ticketCode(anytime[1]))
      assert.equal(after.id, anytime[1].id)
      assert(after.checkedInAt)
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(anytime[1])), "ALREADY_CHECKED_IN")
    })
    await t.test("تعطيل الفعالية يمنع الدخول حتى بدون قيود وقت", async () => {
      await pg.query("UPDATE products SET event_ends_at=NOW()+INTERVAL '1 hour',is_active=false WHERE id=$1", [product])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "EVENT_UNAVAILABLE")
      await pg.query("UPDATE products SET is_active=true WHERE id=$1", [product])
    })
    await t.test("الدفع المعلق لا يسمح بالدخول أو إصدار تذاكر إضافية", async () => {
      await pg.query("UPDATE orders SET status='pending' WHERE id=$1", [order])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "PAYMENT_UNCONFIRMED")
      await issueTickets(connection, order)
      assert.equal((await tickets()).length, 3)
      assert.deepEqual((await tickets()).map((ticket) => ticket.ticketNumber).sort((a, b) => a - b), [1, 2, 3])
      await pg.query("UPDATE orders SET status='paid' WHERE id=$1", [order])
      await pg.query("UPDATE orders SET paid_at=NULL WHERE id=$1", [order])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "PAYMENT_UNCONFIRMED")
      await pg.query("UPDATE orders SET paid_at=NOW() WHERE id=$1", [order])
    })
    await t.test("تعطيل صاحب التذكرة يمنع الدخول", async () => {
      await pg.query("UPDATE users SET is_active=false WHERE id=$1", [buyer])
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(second)), "OWNER_INACTIVE")
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
      await rejectsCode(admitTicket(connection, staff, product, ticketCode(third)), "TICKET_REVOKED")
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
