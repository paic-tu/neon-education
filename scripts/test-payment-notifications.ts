import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { buildPaymentReceipt } from "../lib/payments/payment-email-content"
import { renderSubscriptionSuccessEmail } from "../lib/emails"
import { renderToStaticMarkup } from "react-dom/server"

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
  const { notifyPaidOrder, notifyCouponOrderWithRetry, retryBuyerPaymentReceipts, retryPendingPaymentReceipts } = await import("../lib/payments/payment-notifications")
  const { runEmailRecovery, getEmailRecoveryHealth, isEmailRecoveryAuthorized } = await import("../lib/payments/email-recovery")
  const { renderEmailRecoveryAlert } = await import("../components/admin/email-recovery-alert")
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
    await pg.exec(readFileSync(new URL("../lib/db/migrations/0013_add_payment_email_recovery.sql", import.meta.url), "utf8"))
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
    await t.test("إيصال تذكرة خصم كامل يعاد إرساله عند الفشل المؤقت دون تكرار", async () => {
      const id = await fixture()
      const productId = randomUUID(), itemId = randomUUID()
      await pg.query("UPDATE orders SET total_amount=0,payment_provider='coupon' WHERE id=$1", [id])
      await pg.query("INSERT INTO products VALUES ($1,'فعالية','Event')", [productId])
      await pg.query("INSERT INTO order_items VALUES ($1,$2,$3,NULL,1,1.00,true)", [itemId, id, productId])
      await pg.query("INSERT INTO event_tickets VALUES ($1,$2,NULL)", [randomUUID(), itemId])
      let attempts = 0
      const send = async (message: any) => {
        attempts++
        assert.equal(message.idempotencyKey, `neon-paid-order/${id}`)
        assert(message.text.includes(`/ar/tickets/${id}`))
        assert(message.text.includes("قسيمة"))
        assert(message.text.includes("0.00"))
        return attempts === 1 ? { success: false } : { success: true, messageId: "coupon-receipt" }
      }
      assert(await notifyCouponOrderWithRetry(id, connection, send))
      assert(await notifyCouponOrderWithRetry(id, connection, send))
      assert.equal(attempts, 2)
      const row = await pg.query<{ sent_at: string; message_id: string }>("SELECT sent_at,message_id FROM payment_email_notifications WHERE order_id=$1", [id])
      assert(row.rows[0].sent_at)
      assert.equal(row.rows[0].message_id, "coupon-receipt")
    })
    await t.test("فشل محاولتي إرسال إيصال الخصم يظهر للمشتري ويمكن استعادته", async () => {
      const id = await fixture()
      await pg.query("UPDATE orders SET total_amount=0,payment_provider='coupon' WHERE id=$1", [id])
      let attempts = 0
      assert.equal(await notifyCouponOrderWithRetry(id, connection, async () => { attempts++; return { success: false } }), false)
      assert.equal(attempts, 2)
      assert(await notifyPaidOrder(id, connection, async () => ({ success: true })))
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
    await t.test("المهمة ترفض التشغيل دون مفتاح قوي وصحيح", () => {
      const secret = "a".repeat(32)
      assert(!isEmailRecoveryAuthorized(null, secret))
      assert(!isEmailRecoveryAuthorized(`Bearer ${secret}`, "short"))
      assert(!isEmailRecoveryAuthorized(`Bearer ${"b".repeat(32)}`, secret))
      assert(isEmailRecoveryAuthorized(`Bearer ${secret}`, secret))
    })
    await t.test("المسار المجدول يرفض الطلب غير المصرح قبل تشغيل أي استعادة", async () => {
      const { GET } = await import("../app/api/cron/payment-emails/route")
      const response = await GET(new Request("https://example.test/api/cron/payment-emails"))
      assert.equal(response.status, 401)
      assert.equal(response.headers.get("cache-control"), "private, no-store")
    })
    await t.test("المحاولة غير المؤكدة القديمة تتوقف لمنع التكرار بعد انتهاء حماية المزود", async () => {
      const id = await fixture()
      await pg.query(`INSERT INTO payment_email_notifications (order_id, first_attempt_at, attempt_count, last_error)
        VALUES ($1,NOW()-INTERVAL '24 hours',1,'EMAIL_DELIVERY_UNCERTAIN')`, [id])
      let sends = 0
      assert.equal(await notifyPaidOrder(id, connection, async () => { sends++; return { success: true } }), false)
      assert.equal(sends, 0)
      assert((await getEmailRecoveryHealth(connection)).review > 0)
    })
    await t.test("رفض النطاق المؤكد يحفظ السبب ويسمح بالاستعادة بعد فترة طويلة", async () => {
      const id = await fixture()
      assert.equal(await notifyPaidOrder(id, connection, async () => ({ success: false, errorCode: "EMAIL_DOMAIN_UNVERIFIED" })), false)
      const result = await pg.query<any>("SELECT last_error,first_attempt_at,next_retry_at FROM payment_email_notifications WHERE order_id=$1", [id])
      assert.equal(result.rows[0].last_error, "EMAIL_DOMAIN_UNVERIFIED")
      assert.equal(result.rows[0].first_attempt_at, null)
      assert(result.rows[0].next_retry_at)
      assert(await notifyPaidOrder(id, connection, async () => ({ success: true, messageId: randomUUID() })))
    })
    await t.test("الاستعادة تعمل دون زيارة المشتري وتحترم موعد المحاولة التالي", async () => {
      await pg.exec("UPDATE orders SET status='cancelled'")
      const id = await fixture()
      await notifyPaidOrder(id, connection, async () => ({ success: false, errorCode: "EMAIL_DOMAIN_UNVERIFIED" }))
      let sends = 0
      const send = async () => { sends++; return { success: true, messageId: randomUUID() } }
      assert.deepEqual(await retryPendingPaymentReceipts(connection, send), { accepted: 0, failed: 0 })
      await pg.query("UPDATE payment_email_notifications SET next_retry_at=NOW()-INTERVAL '1 minute' WHERE order_id=$1", [id])
      assert.deepEqual(await retryPendingPaymentReceipts(connection, send), { accepted: 1, failed: 0 })
      assert.equal(sends, 1)
    })
    await t.test("الطلبات التاريخية غير المسجلة لا ترسل تلقائيا عند تفعيل الاستعادة", async () => {
      await pg.exec("UPDATE orders SET status='cancelled'")
      const old = await fixture()
      await pg.query("UPDATE orders SET paid_at=NOW()-INTERVAL '30 days' WHERE id=$1", [old])
      let sends = 0
      assert.deepEqual(await retryPendingPaymentReceipts(connection, async () => { sends++; return { success: true } }), { accepted: 0, failed: 0 })
      assert.equal(sends, 0)
      const legacy = await fixture()
      await pg.query("INSERT INTO payment_email_notifications (order_id) VALUES ($1)", [legacy])
      await pg.exec(readFileSync(new URL("../lib/db/migrations/0013_add_payment_email_recovery.sql", import.meta.url), "utf8"))
      assert.equal(await notifyPaidOrder(legacy, connection, async () => { sends++; return { success: true } }), false)
      assert.equal(sends, 0)
    })
    await t.test("مهمة واحدة تستعيد دفعات محدودة وتتابع التسليم دون إعادة الرسائل المقبولة", async () => {
      await pg.exec("UPDATE orders SET status='cancelled'")
      await pg.exec("DELETE FROM payment_email_notifications")
      await pg.exec("UPDATE payment_email_health SET domain_status='verified',last_error=NULL,last_run_at=NOW()")
      assert.equal(await renderEmailRecoveryAlert({ lang: "ar" }, connection), null)
      for (let i = 0; i < 7; i++) await fixture()
      const previousKey = process.env.RESEND_API_KEY, previousFrom = process.env.RESEND_FROM
      process.env.RESEND_API_KEY = "test-key"
      process.env.RESEND_FROM = "Neon <receipt@example.test>"
      let sends = 0
      let domainVerified = true
      let deliveryEvent = "delivered"
      let providerUnavailable = false
      let missingMessage = false
      const send = async () => { sends++; return { success: true, messageId: randomUUID() } }
      const request: typeof fetch = async (url, options) => {
        assert(options?.signal instanceof AbortSignal)
        if (providerUnavailable) throw new Error("Provider unavailable")
        const path = String(url).replace("https://api.resend.com", "")
        if (path === "/domains") return Response.json({ data: [{ id: "domain", name: "example.test" }] })
        if (path === "/domains/domain") return Response.json({ status: domainVerified ? "verified" : "partially_failed" })
        if (path.startsWith("/emails/")) return missingMessage
          ? Response.json({}, { status: 404 }) : Response.json({ last_event: deliveryEvent })
        throw new Error("Unexpected provider request")
      }
      try {
        const outcomes = await Promise.all([runEmailRecovery(connection, send, request), runEmailRecovery(connection, send, request)])
        assert(outcomes.some((outcome) => outcome.skipped))
        assert.equal(sends, 5)
        assert.equal((await getEmailRecoveryHealth(connection)).pending, 0) // New orders are not overdue.
        await runEmailRecovery(connection, send, request)
        assert.equal(sends, 7)
        await runEmailRecovery(connection, send, request)
        assert.equal(sends, 7)
        assert.equal((await getEmailRecoveryHealth(connection)).deliveryIssues, 0)
        const events = await pg.query<any>("SELECT count(*)::int AS count FROM payment_email_notifications WHERE last_event='delivered'")
        assert.equal(events.rows[0].count, 7)
        domainVerified = false
        await fixture()
        const blocked = await runEmailRecovery(connection, send, request)
        assert.equal(blocked.domainStatus, "unverified")
        assert.equal(sends, 7)
        assert.equal((await getEmailRecoveryHealth(connection)).domainStatus, "unverified")
        domainVerified = true
        deliveryEvent = "bounced"
        await runEmailRecovery(connection, send, request)
        assert.equal(sends, 8)
        assert.equal((await getEmailRecoveryHealth(connection)).deliveryIssues, 1)
        await runEmailRecovery(connection, send, request)
        assert.equal(sends, 8) // Bounced mail must not be resent.
        await fixture()
        missingMessage = true
        await runEmailRecovery(connection, send, request)
        assert.equal((await getEmailRecoveryHealth(connection)).deliveryIssues, 2)
        providerUnavailable = true
        await assert.rejects(runEmailRecovery(connection, send, request), /EMAIL_RECOVERY_FAILED/)
        assert.equal((await getEmailRecoveryHealth(connection)).monitorError, "EMAIL_RECOVERY_FAILED")
        providerUnavailable = false
        await runEmailRecovery(connection, send, request)
        assert.equal((await getEmailRecoveryHealth(connection)).monitorError, null)
        await pg.exec("UPDATE payment_email_health SET last_run_at=NOW()-INTERVAL '16 minutes'")
        assert((await getEmailRecoveryHealth(connection)).stale)
        const arAlert = renderToStaticMarkup((await renderEmailRecoveryAlert({ lang: "ar" }, connection))!)
        const enAlert = renderToStaticMarkup((await renderEmailRecoveryAlert({ lang: "en" }, connection))!)
        assert(arAlert.includes('role="alert"'))
        assert(arAlert.includes("تنبيه خدمة إيصالات الدفع"))
        assert(enAlert.includes("Payment Receipt Alert"))
      } finally {
        if (previousKey === undefined) delete process.env.RESEND_API_KEY
        else process.env.RESEND_API_KEY = previousKey
        if (previousFrom === undefined) delete process.env.RESEND_FROM
        else process.env.RESEND_FROM = previousFrom
      }
    })
  } finally {
    await pg.close()
  }
})
