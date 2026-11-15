import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { sendMail } from "@/lib/mail"
import { buildPaymentReceipt } from "@/lib/payments/payment-email-content"

export type Connection = { execute: (query: ReturnType<typeof sql>) => Promise<any> }
export type MailSender = (message: { to: string; subject: string; text: string; html: string; idempotencyKey?: string }) => Promise<{ success: boolean; messageId?: string; error?: string; errorCode?: string }>
const rows = (result: any): any[] => Array.isArray(result) ? result : result.rows || []

export async function retryBuyerPaymentReceipts(userId: string, connection: Connection = db, send: MailSender = sendMail) {
  const pending = rows(await connection.execute(sql`
    SELECT o.id FROM orders o
    LEFT JOIN payment_email_notifications n ON n.order_id = o.id
    WHERE o.user_id = ${userId}::uuid AND o.status = 'paid' AND o.paid_at IS NOT NULL
      AND o.paid_at > NOW() - INTERVAL '7 days' AND n.sent_at IS NULL
      AND (n.claimed_at IS NULL OR n.claimed_at < NOW() - INTERVAL '10 minutes')
    ORDER BY o.paid_at DESC LIMIT 3
  `))
  for (const order of pending) await notifyPaidOrder(order.id, connection, send)
}

export async function notifyPaidOrder(orderId: string, connection: Connection = db, send: MailSender = sendMail) {
  const claimId = randomUUID()
  let claimed = false
  let phase = "claim"
  try {
    // الحجز مشترك بين السيرفرات، ويمنع الإرسال المتزامن من صفحة العودة وإشعار الدفع.
    const claim = rows(await connection.execute(sql`
      INSERT INTO payment_email_notifications (order_id, claim_id, claimed_at, attempt_count, first_attempt_at)
      SELECT id, ${claimId}::uuid, NOW(), 1, NOW() FROM orders
      WHERE id = ${orderId}::uuid AND status = 'paid' AND paid_at IS NOT NULL
      ON CONFLICT (order_id) DO UPDATE SET claim_id = EXCLUDED.claim_id, claimed_at = NOW(),
        attempt_count = payment_email_notifications.attempt_count + 1,
        first_attempt_at = COALESCE(payment_email_notifications.first_attempt_at, NOW())
      WHERE payment_email_notifications.sent_at IS NULL
        AND (payment_email_notifications.claimed_at IS NULL
          OR payment_email_notifications.claimed_at < NOW() - INTERVAL '10 minutes')
        AND (payment_email_notifications.first_attempt_at IS NULL
          OR payment_email_notifications.first_attempt_at > NOW() - INTERVAL '23 hours')
      RETURNING order_id
    `))
    if (!claim.length) {
      const [state] = rows(await connection.execute(sql`
        SELECT o.status, n.sent_at FROM orders o
        LEFT JOIN payment_email_notifications n ON n.order_id = o.id WHERE o.id = ${orderId}::uuid
      `))
      return !state || state.status !== "paid" || Boolean(state.sent_at)
    }
    claimed = true
    phase = "load_order"
    const [order] = rows(await connection.execute(sql`
      SELECT o.id, o.total_amount AS "totalAmount", o.paid_at AS "paidAt", o.payment_provider AS "paymentProvider",
        u.name, u.email, (SELECT count(*)::int FROM event_tickets t
          JOIN order_items i ON i.id = t.order_item_id WHERE i.order_id = o.id AND t.revoked_at IS NULL) AS "ticketCount"
      FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.id = ${orderId}::uuid AND o.status = 'paid' AND o.paid_at IS NOT NULL
    `))
    if (!order?.email) throw new Error("لا يوجد مستلم صالح لإيصال الدفع")
    phase = "load_items"
    const items = rows(await connection.execute(sql`
      SELECT COALESCE(p.name_ar, c.title_ar, p.name_en, c.title_en, 'طلب نيون') AS name,
        i.quantity, i.price, i.is_event_ticket AS "isEventTicket"
      FROM order_items i LEFT JOIN products p ON p.id = i.product_id
      LEFT JOIN courses c ON c.id = i.course_id WHERE i.order_id = ${orderId}::uuid
    `))
    phase = "render"
    const receipt = await buildPaymentReceipt({ ...order, items })
    phase = "send"
    const delivered = await send({
      to: order.email, subject: receipt.subject, html: receipt.html, text: receipt.text,
      idempotencyKey: `neon-paid-order/${orderId}`,
    })
    if (!delivered.success) throw Object.assign(new Error(delivered.error || "تعذر إرسال إيصال الدفع"), { code: delivered.errorCode || "EMAIL_DELIVERY_FAILED" })
    phase = "record"
    await connection.execute(sql`
      UPDATE payment_email_notifications SET sent_at = NOW(), message_id = ${delivered.messageId || null},
        last_error = NULL, next_retry_at = NULL, last_event = 'accepted'
      WHERE order_id = ${orderId}::uuid AND claim_id = ${claimId}::uuid
    `)
    return true
  } catch (error) {
    const code = phase === "send" || phase === "record"
      ? (error as { code?: string })?.code || "EMAIL_DELIVERY_UNCERTAIN"
      : "EMAIL_PREPARATION_FAILED"
    const definitelyNotSent = ["EMAIL_DOMAIN_UNVERIFIED", "EMAIL_PROVIDER_REJECTED", "EMAIL_PREPARATION_FAILED", "EMAIL_RECEIPT_PROVIDER_NOT_CONFIGURED"].includes(code)
    if (claimed) await connection.execute(sql`
      UPDATE payment_email_notifications SET claimed_at = NULL, claim_id = NULL,
        last_error = ${code.slice(0, 80)},
        first_attempt_at = CASE WHEN ${definitelyNotSent} THEN NULL ELSE first_attempt_at END,
        next_retry_at = NOW() + LEAST(60, POWER(2, LEAST(attempt_count, 6))) * INTERVAL '1 minute'
      WHERE order_id = ${orderId}::uuid AND claim_id = ${claimId}::uuid AND sent_at IS NULL
    `).catch(() => {})
    console.error("تعذر إرسال إيصال الدفع للطلب", {
      orderId, phase, errorName: error instanceof Error ? error.name : "Unknown",
      errorCode: error instanceof Error ? (error as Error & { code?: string }).code : undefined,
    })
    return false
  }
}

export async function retryPendingPaymentReceipts(connection: Connection = db, send: MailSender = sendMail, deadline = Date.now() + 40_000) {
  const pending = rows(await connection.execute(sql`
    SELECT o.id FROM orders o LEFT JOIN payment_email_notifications n ON n.order_id = o.id
    WHERE o.status = 'paid' AND o.paid_at IS NOT NULL AND n.sent_at IS NULL
      AND (n.order_id IS NOT NULL OR o.paid_at >= (SELECT recovery_from FROM payment_email_health WHERE id = 'global'))
      AND (n.next_retry_at IS NULL OR n.next_retry_at <= NOW())
      AND (n.claimed_at IS NULL OR n.claimed_at < NOW() - INTERVAL '10 minutes')
      AND (n.first_attempt_at IS NULL OR n.first_attempt_at > NOW() - INTERVAL '23 hours')
    ORDER BY n.next_retry_at ASC NULLS FIRST, o.paid_at ASC LIMIT 5
  `))
  let accepted = 0, failed = 0
  for (const order of pending) {
    if (Date.now() >= deadline) break
    if (await notifyPaidOrder(order.id, connection, send)) accepted++
    else failed++
  }
  return { accepted, failed }
}

export async function notifyCouponOrderWithRetry(orderId: string, connection: Connection = db, send: MailSender = sendMail) {
  if (await notifyPaidOrder(orderId, connection, send)) return true
  return notifyPaidOrder(orderId, connection, send)
}
