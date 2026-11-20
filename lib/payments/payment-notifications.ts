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
    SELECT DISTINCT o.id, o.paid_at FROM order_email_queue o
    LEFT JOIN payment_email_notifications n ON n.order_id = o.id
    WHERE o.user_id = ${userId}::uuid AND o.status = 'paid' AND o.paid_at IS NOT NULL
      AND o.paid_at > NOW() - INTERVAL '7 days' AND o.sent_at IS NULL
      AND (o.message_type = 'receipt' OR n.sent_at IS NOT NULL)
      AND (o.claimed_at IS NULL OR o.claimed_at < NOW() - INTERVAL '10 minutes')
    ORDER BY o.paid_at DESC LIMIT 3
  `))
  for (const order of pending) await notifyPaidOrder(order.id, connection, send)
}

export async function notifyPaidOrder(orderId: string, connection: Connection = db, send: MailSender = sendMail) {
  if (!await notifyOrderMessage(orderId, "receipt", connection, send)) return false
  return notifyOrderMessage(orderId, "tickets", connection, send)
}

async function notifyOrderMessage(orderId: string, messageType: "receipt" | "tickets", connection: Connection, send: MailSender) {
  // Table names are fixed here, never supplied by a request.
  const table = sql.raw(messageType === "receipt" ? "payment_email_notifications" : "ticket_email_notifications")
  const required = messageType === "receipt" ? sql`TRUE` : sql`
    paid_at >= (SELECT ticket_email_from FROM payment_email_health WHERE id = 'global')
    AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = orders.id AND i.is_event_ticket)`
  const claimId = randomUUID()
  let claimed = false
  let phase = "claim"
  try {
    // الحجز مشترك بين السيرفرات، ويمنع الإرسال المتزامن من صفحة العودة وإشعار الدفع.
    const claim = rows(await connection.execute(sql`
      INSERT INTO ${table} (order_id, claim_id, claimed_at, attempt_count, first_attempt_at)
      SELECT id, ${claimId}::uuid, NOW(), 1, NOW() FROM orders
      WHERE id = ${orderId}::uuid AND status = 'paid' AND paid_at IS NOT NULL AND (${required})
      ON CONFLICT (order_id) DO UPDATE SET claim_id = EXCLUDED.claim_id, claimed_at = NOW(),
        attempt_count = ${table}.attempt_count + 1,
        first_attempt_at = COALESCE(${table}.first_attempt_at, NOW())
      WHERE ${table}.sent_at IS NULL
        AND (${table}.claimed_at IS NULL
          OR ${table}.claimed_at < NOW() - INTERVAL '10 minutes')
        AND (${table}.first_attempt_at IS NULL
          OR ${table}.first_attempt_at > NOW() - INTERVAL '23 hours')
      RETURNING order_id
    `))
    if (!claim.length) {
      const [state] = rows(await connection.execute(sql`
        SELECT orders.status, n.sent_at, (${required}) AS required FROM orders
        LEFT JOIN ${table} n ON n.order_id = orders.id WHERE orders.id = ${orderId}::uuid
      `))
      return !state || state.status !== "paid" || !state.required || Boolean(state.sent_at)
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
        i.quantity, i.price, i.is_event_ticket AS "isEventTicket", i.selected_add_ons AS "selectedAddOns"
      FROM order_items i LEFT JOIN products p ON p.id = i.product_id
      LEFT JOIN courses c ON c.id = i.course_id WHERE i.order_id = ${orderId}::uuid
    `))
    phase = "render"
    const receipt = await buildPaymentReceipt({ ...order, items }, messageType)
    phase = "send"
    const delivered = await send({
      to: order.email, subject: receipt.subject, html: receipt.html, text: receipt.text,
      idempotencyKey: messageType === "receipt" ? `neon-paid-order/${orderId}` : `neon-order-tickets/${orderId}`,
    })
    if (!delivered.success) throw Object.assign(new Error(delivered.error || "تعذر إرسال إيصال الدفع"), { code: delivered.errorCode || "EMAIL_DELIVERY_FAILED" })
    phase = "record"
    await connection.execute(sql`
      UPDATE ${table} SET sent_at = NOW(), message_id = ${delivered.messageId || null},
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
      UPDATE ${table} SET claimed_at = NULL, claim_id = NULL,
        last_error = ${code.slice(0, 80)},
        first_attempt_at = CASE WHEN ${definitelyNotSent} THEN NULL ELSE first_attempt_at END,
        next_retry_at = NOW() + LEAST(60, POWER(2, LEAST(attempt_count, 6))) * INTERVAL '1 minute'
      WHERE order_id = ${orderId}::uuid AND claim_id = ${claimId}::uuid AND sent_at IS NULL
    `).catch(() => {})
    console.error("تعذر إرسال إيصال الدفع للطلب", {
      orderId, messageType, phase, errorName: error instanceof Error ? error.name : "Unknown",
      errorCode: error instanceof Error ? (error as Error & { code?: string }).code : undefined,
    })
    return false
  }
}

export async function retryPendingPaymentReceipts(connection: Connection = db, send: MailSender = sendMail, deadline = Date.now() + 40_000) {
  const pending = rows(await connection.execute(sql`
    SELECT o.id, o.message_type FROM order_email_queue o
    LEFT JOIN payment_email_notifications n ON n.order_id = o.id
    WHERE o.status = 'paid' AND o.paid_at IS NOT NULL AND o.sent_at IS NULL
      AND (o.message_type = 'receipt' OR n.sent_at IS NOT NULL)
      AND (o.next_retry_at IS NULL OR o.next_retry_at <= NOW())
      AND (o.claimed_at IS NULL OR o.claimed_at < NOW() - INTERVAL '10 minutes')
      AND (o.first_attempt_at IS NULL OR o.first_attempt_at > NOW() - INTERVAL '23 hours')
    ORDER BY o.next_retry_at ASC NULLS FIRST, o.paid_at ASC LIMIT 5
  `))
  let accepted = 0, failed = 0
  for (const order of pending) {
    if (Date.now() >= deadline) break
    if (await notifyOrderMessage(order.id, order.message_type, connection, send)) accepted++
    else failed++
  }
  return { accepted, failed }
}

export async function notifyCouponOrderWithRetry(orderId: string, connection: Connection = db, send: MailSender = sendMail) {
  if (await notifyPaidOrder(orderId, connection, send)) return true
  return notifyPaidOrder(orderId, connection, send)
}
