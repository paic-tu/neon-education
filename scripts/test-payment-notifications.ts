import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { buildPaymentReceipt } from "../lib/payments/payment-email-content"
import { renderSubscriptionSuccessEmail } from "../lib/emails"

test("إيصال الدفع يستخدم قالب نيون الموحد ورابطاً خاصاً دون رمز دخول", async () => {
  const id = randomUUID()
  const receipt = await buildPaymentReceipt({
    id, name: "<script>alert(1)</script>", totalAmount: "1.00", paidAt: new Date(),
    paymentProvider: "stream", ticketCount: 1,
    items: [{ name: "neon ora", price: "1.00", quantity: 1, isEventTicket: true }],
  })
  assert.equal(receipt.url, `https://neonedu.org/ar/tickets/${id}`)
  assert(receipt.text.includes("تسجيل الدخول"))
  assert(!receipt.html.includes("<script>"))
  assert(!receipt.html.includes("NEVT1."))
  assert(receipt.html.includes("1.00 ريال"))
  assert(receipt.html.includes("neon-bg"))
  assert(receipt.html.includes("Tajawal"))
  assert(receipt.html.includes("https://linktr.ee/neonedusa"))
  assert(receipt.html.includes('dir="rtl"'))
  assert(receipt.html.includes("&lt;script&gt;"))
})

test("طلبات المتجر والدورات تحصل على إيصال دون رابط باركود", async () => {
  const receipt = await buildPaymentReceipt({
    id: randomUUID(), name: "Buyer", totalAmount: "10.00", paidAt: new Date(),
    paymentProvider: "manual", ticketCount: 0,
    items: [{ name: "Course", price: "10.00", quantity: 1, isEventTicket: false }],
  })
  assert.equal(receipt.url, "https://neonedu.org/ar/orders")
  assert(receipt.text.includes("دفع أكدته الإدارة"))
})

test("قالب الاشتراك الأصلي يبقى كما هو عند عدم تمرير إيصال", async () => {
  const email = await renderSubscriptionSuccessEmail({
    language: "en", planName: "Neon Plan", dashboardUrl: "https://neonedu.org/en/student/dashboard",
  })
  assert(email.text.includes("Your subscription is active"))
  assert(email.text.includes("Neon Plan"))
  assert(!email.html.includes("Event tickets:"))
  assert(email.html.includes("neon-bg"))
})

test("حجز البريد في قاعدة البيانات والتكرار وإعادة المحاولة", async (t) => {
  // عنوان غير مستخدم يمنع فتح قاعدة محلية؛ جميع الاستعلامات تمر عبر قاعدة الاختبار المحقونة.
  process.env.DATABASE_URL ||= "postgresql://unused@localhost/unused"
  const { notifyPaidOrder, retryBuyerPaymentReceipts } = await import("../lib/payments/payment-notifications")
  const pg = new PGlite()
  const connection = drizzle(pg)
  try {
    await pg.exec(`
      CREATE TABLE users (id UUID PRIMARY KEY, name TEXT, email TEXT);
      CREATE TABLE orders (id UUID PRIMARY KEY, user_id UUID, status TEXT, total_amount NUMERIC(10,2), paid_at TIMESTAMP, payment_provider TEXT);
      CREATE TABLE products (id UUID PRIMARY KEY, name_ar TEXT, name_en TEXT);
      CREATE TABLE courses (id UUID PRIMARY KEY, title_ar TEXT, title_en TEXT);
      CREATE TABLE order_items (id UUID PRIMARY KEY, order_id UUID, product_id UUID, course_id UUID, quantity INTEGER, price NUMERIC(10,2), is_event_ticket BOOLEAN);
      CREATE TABLE event_tickets (id UUID PRIMARY KEY, order_item_id UUID, revoked_at TIMESTAMP);
    `)
    await pg.exec(readFileSync(new URL("../lib/db/migrations/0012_add_payment_email_notifications.sql", import.meta.url), "utf8"))
    const fixture = async (status = "paid") => {
      const id = randomUUID(), userId = randomUUID()
      await pg.query("INSERT INTO users VALUES ($1,'Buyer','buyer@example.test')", [userId])
      await pg.query("INSERT INTO orders VALUES ($1,$2,$3,1.00,NOW(),'stream')", [id, userId, status])
      return id
    }
    await t.test("الإشعارات المتزامنة والمتكررة ترسل مرة واحدة", async () => {
      const id = await fixture()
      let messages = 0
      const send = async (message: any) => {
        assert.equal(message.to, "buyer@example.test")
        assert.equal(message.idempotencyKey, `neon-paid-order/${id}`)
        messages++
        return { success: true, messageId: "test-message" }
      }
      await Promise.all([notifyPaidOrder(id, connection, send), notifyPaidOrder(id, connection, send)])
      assert(await notifyPaidOrder(id, connection, send))
      assert.equal(messages, 1)
    })
    await t.test("فشل الإرسال يحرر الحجز لإعادة المحاولة", async () => {
      const id = await fixture()
      assert.equal(await notifyPaidOrder(id, connection, async () => ({ success: false })), false)
      assert.equal(await notifyPaidOrder(id, connection, async () => ({ success: true })), true)
      const row = await pg.query<{ sent_at: string }>("SELECT sent_at FROM payment_email_notifications WHERE order_id=$1", [id])
      assert(row.rows[0].sent_at)
    })
    await t.test("الطلبات غير المدفوعة والملغاة لا ترسل إيصالاً", async () => {
      for (const status of ["pending", "cancelled"]) {
        const id = await fixture(status)
        await notifyPaidOrder(id, connection, async () => { throw new Error("يجب ألا يُرسل البريد") })
        const result = await pg.query<{ count: number }>("SELECT count(*)::int AS count FROM payment_email_notifications WHERE order_id=$1", [id])
        assert.equal(result.rows[0].count, 0)
      }
    })
    await t.test("استعادة الحجز بعد انقطاع السيرفر", async () => {
      const id = await fixture()
      await pg.query("INSERT INTO payment_email_notifications (order_id,claim_id,claimed_at) VALUES ($1,$2,NOW()-INTERVAL '11 minutes')", [id, randomUUID()])
      assert(await notifyPaidOrder(id, connection, async () => ({ success: true })))
    })
    await t.test("إعادة المحاولة تخص المشتري والطلبات المدفوعة الحديثة فقط", async () => {
      const id = await fixture()
      const { rows: buyer } = await pg.query<{ user_id: string }>("SELECT user_id FROM orders WHERE id=$1", [id])
      const other = await fixture()
      const old = await fixture()
      await pg.query("UPDATE orders SET user_id=$1,paid_at=NOW()-INTERVAL '8 days' WHERE id=$2", [buyer[0].user_id, old])
      const pending = await fixture("pending")
      await pg.query("UPDATE orders SET user_id=$1 WHERE id=$2", [buyer[0].user_id, pending])
      let sends = 0
      const send = async (message: any) => {
        assert.equal(message.idempotencyKey, `neon-paid-order/${id}`)
        sends++
        return { success: true }
      }
      await retryBuyerPaymentReceipts(buyer[0].user_id, connection, send)
      await retryBuyerPaymentReceipts(buyer[0].user_id, connection, send)
      assert.equal(sends, 1)
      const result = await pg.query<{ count: number }>("SELECT count(*)::int AS count FROM payment_email_notifications WHERE order_id IN ($1,$2,$3)", [other, old, pending])
      assert.equal(result.rows[0].count, 0)
    })
  } finally {
    await pg.close()
  }
})
