import { sql, eq, and } from "drizzle-orm"
import { eventTickets } from "@/lib/db/schema"
import { getTicketSigningKey, parseTicketCode, verifyTicketCode } from "@/lib/event-ticket-code"

export class EventError extends Error {
  constructor(public status: number, public code: string) {
    super(code)
  }
}

export function resultRows<T>(result: { rows?: T[] } | T[]): T[] {
  return Array.isArray(result) ? result : result.rows || []
}

export async function issueTickets(connection: any, orderId: string) {
  // الإدراج المتكرر آمن، ولا يعتمد على صفحة نجاح الدفع أو بيانات العميل.
  const result = await connection.execute(sql`
    INSERT INTO event_tickets (order_item_id, product_id, user_id, ordinal)
    SELECT i.id, i.product_id, o.user_id, n.ordinal
    FROM order_items i JOIN orders o ON o.id = i.order_id
    JOIN products p ON p.id = i.product_id
    CROSS JOIN LATERAL generate_series(1, LEAST(i.quantity, 99)) n(ordinal)
    WHERE o.id = ${orderId}::uuid AND o.status = 'paid' AND o.paid_at IS NOT NULL
      AND i.is_event_ticket = true AND i.quantity BETWEEN 1 AND 99
      AND p.product_type = 'event_ticket'
      AND o.payment_provider IN ('stream', 'coupon')
    ORDER BY i.product_id, i.id, n.ordinal
    ON CONFLICT (order_item_id, ordinal) DO NOTHING
    RETURNING id
  `)
  return resultRows<{ id: string }>(result)
}

export async function revokeTickets(connection: any, orderId: string) {
  await connection.execute(sql`
    UPDATE event_tickets SET revoked_at = COALESCE(revoked_at, NOW())
    WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ${orderId}::uuid)
  `)
}

export async function admitTicket(connection: any, userId: string, productId: string, code: string) {
  getTicketSigningKey()
  const allowed = resultRows(await connection.execute(sql`
    SELECT 1 FROM users u WHERE u.id = ${userId}::uuid AND u.is_active AND
      (u.role = 'admin' OR (u.role = 'event_staff' AND EXISTS (
        SELECT 1 FROM event_staff_assignments a WHERE a.user_id = u.id AND a.product_id = ${productId}::uuid
      )))
  `))
  if (!allowed.length) throw new EventError(403, "FORBIDDEN")

  // عداد قاعدة البيانات مشترك بين جميع نسخ السيرفر، وليس عداداً محلياً في الذاكرة.
  const quota = resultRows(await connection.execute(sql`
    INSERT INTO event_scan_limits (user_id, window_starts_at, attempts)
    VALUES (${userId}::uuid, date_trunc('minute', NOW()), 1)
    ON CONFLICT (user_id) DO UPDATE SET
      window_starts_at = date_trunc('minute', NOW()),
      attempts = CASE WHEN event_scan_limits.window_starts_at < date_trunc('minute', NOW())
        THEN 1 ELSE event_scan_limits.attempts + 1 END
    WHERE event_scan_limits.window_starts_at < date_trunc('minute', NOW()) OR event_scan_limits.attempts < 60
    RETURNING user_id
  `))
  if (!quota.length) throw new EventError(429, "RATE_LIMITED")

  const parsed = parseTicketCode(code)
  const [ticket] = parsed ? await connection.select().from(eventTickets)
    .where(and(eq(eventTickets.id, parsed.id), eq(eventTickets.productId, productId))).limit(1) : []
  if (!ticket || !verifyTicketCode(code, ticket)) {
    await connection.execute(sql`
      INSERT INTO audit_logs (user_id, action, resource, resource_id, changes)
      VALUES (${userId}::uuid, 'event_scan_rejected', 'event', ${productId}::uuid, '{"reason":"INVALID_TICKET"}'::jsonb)
    `)
    throw new EventError(400, "INVALID_TICKET")
  }

  // التحديث المشروط وسجل التدقيق في عبارة واحدة: جهاز واحد فقط يستطيع قبول التذكرة.
  const accepted = resultRows<any>(await connection.execute(sql`
    WITH accepted AS (
      UPDATE event_tickets t SET checked_in_at = NOW(), checked_in_by = ${userId}::uuid
      WHERE t.id = ${ticket.id}::uuid AND t.product_id = ${productId}::uuid
        AND t.checked_in_at IS NULL AND t.revoked_at IS NULL
        AND EXISTS (SELECT 1 FROM order_items i JOIN orders o ON o.id = i.order_id
          WHERE i.id = t.order_item_id AND o.status = 'paid' AND o.paid_at IS NOT NULL)
        AND EXISTS (SELECT 1 FROM products p WHERE p.id = t.product_id AND p.is_active
          AND p.product_type = 'event_ticket' AND NOW() BETWEEN p.event_starts_at AND p.event_ends_at)
        AND EXISTS (SELECT 1 FROM users owner WHERE owner.id = t.user_id AND owner.is_active)
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = ${userId}::uuid AND u.is_active
          AND (u.role = 'admin' OR (u.role = 'event_staff' AND EXISTS (
            SELECT 1 FROM event_staff_assignments a WHERE a.user_id = u.id AND a.product_id = t.product_id
          ))))
      RETURNING t.id, t.user_id, t.checked_in_at
    ), logged AS (
      INSERT INTO audit_logs (user_id, action, resource, resource_id, changes)
      SELECT ${userId}::uuid, 'event_check_in', 'event_ticket', id,
        jsonb_build_object('productId', ${productId}::text, 'checkedInAt', checked_in_at)
      FROM accepted RETURNING id
    )
    SELECT a.id, a.checked_in_at AS "checkedInAt", u.name AS "attendeeName"
    FROM accepted a JOIN users u ON u.id = a.user_id WHERE EXISTS (SELECT 1 FROM logged)
  `))
  if (accepted.length) return accepted[0]

  await connection.execute(sql`
    INSERT INTO audit_logs (user_id, action, resource, resource_id, changes)
    VALUES (${userId}::uuid, 'event_scan_rejected', 'event_ticket', ${ticket.id}::uuid,
      jsonb_build_object('reason', 'NOT_ADMISSIBLE', 'productId', ${productId}::text))
  `)
  const [fresh] = await connection.select({ checkedInAt: eventTickets.checkedInAt }).from(eventTickets)
    .where(eq(eventTickets.id, ticket.id)).limit(1)
  throw new EventError(409, fresh?.checkedInAt ? "ALREADY_CHECKED_IN" : "NOT_ADMISSIBLE")
}
