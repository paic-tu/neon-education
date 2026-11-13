import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { sendMail } from "@/lib/mail"
import { buildPaymentReceipt } from "@/lib/payments/payment-email-content"

type Connection = { execute: (query: ReturnType<typeof sql>) => Promise<any> }
type MailSender = (message: { to: string; subject: string; text: string; html: string; idempotencyKey?: string }) => Promise<{ success: boolean; messageId?: string; error?: string }>
const rows = (result: any): any[] => Array.isArray(result) ? result : result.rows || []

export async function notifyPaidOrder(orderId: string, connection: Connection = db, send: MailSender = sendMail) {
  const claimId = randomUUID()
  let claimed = false
  try {
    // الحجز مشترك بين السيرفرات، ويمنع الإرسال المتزامن من صفحة العودة وإشعار الدفع.
    const claim = rows(await connection.execute(sql`
      INSERT INTO payment_email_notifications (order_id, claim_id, claimed_at)
      SELECT id, ${claimId}::uuid, NOW() FROM orders
      WHERE id = ${orderId}::uuid AND status = 'paid' AND paid_at IS NOT NULL
      ON CONFLICT (order_id) DO UPDATE SET claim_id = EXCLUDED.claim_id, claimed_at = NOW()
      WHERE payment_email_notifications.sent_at IS NULL
        AND (payment_email_notifications.claimed_at IS NULL
          OR payment_email_notifications.claimed_at < NOW() - INTERVAL '10 minutes')
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
    const [order] = rows(await connection.execute(sql`
      SELECT o.id, o.total_amount AS "totalAmount", o.paid_at AS "paidAt", o.payment_provider AS "paymentProvider",
        u.name, u.email, (SELECT count(*)::int FROM event_tickets t
          JOIN order_items i ON i.id = t.order_item_id WHERE i.order_id = o.id AND t.revoked_at IS NULL) AS "ticketCount"
      FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.id = ${orderId}::uuid AND o.status = 'paid' AND o.paid_at IS NOT NULL
    `))
    if (!order?.email) throw new Error("لا يوجد مستلم صالح لإيصال الدفع")
    const items = rows(await connection.execute(sql`
      SELECT COALESCE(p.name_ar, c.title_ar, p.name_en, c.title_en, 'طلب نيون') AS name,
        i.quantity, i.price, i.is_event_ticket AS "isEventTicket"
      FROM order_items i LEFT JOIN products p ON p.id = i.product_id
      LEFT JOIN courses c ON c.id = i.course_id WHERE i.order_id = ${orderId}::uuid
    `))
    const receipt = buildPaymentReceipt({ ...order, items })
    const delivered = await send({
      to: order.email, subject: receipt.subject, html: receipt.html, text: receipt.text,
      idempotencyKey: `neon-paid-order/${orderId}`,
    })
    if (!delivered.success) throw new Error("تعذر إرسال إيصال الدفع")
    await connection.execute(sql`
      UPDATE payment_email_notifications SET sent_at = NOW(), message_id = ${delivered.messageId || null}
      WHERE order_id = ${orderId}::uuid AND claim_id = ${claimId}::uuid
    `)
    return true
  } catch {
    if (claimed) await connection.execute(sql`
      UPDATE payment_email_notifications SET claimed_at = NULL, claim_id = NULL
      WHERE order_id = ${orderId}::uuid AND claim_id = ${claimId}::uuid AND sent_at IS NULL
    `).catch(() => {})
    console.error("تعذر إرسال إيصال الدفع للطلب", orderId)
    return false
  }
}
