import { sql, eq, and, gt, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, eventTickets, products, orderItems, orders } from "@/lib/db/schema"
import { auth } from "@/lib/auth"
import { admitTicket, issueTickets, revokeTickets, EventError, resultRows } from "@/lib/event-ticket-service"
export { EventError, resultRows } from "@/lib/event-ticket-service"

export async function requireEventUser(adminOnly = false) {
  const session = await auth()
  if (!session?.user?.id) throw new EventError(401, "UNAUTHENTICATED")
  const [user] = await db.select({ id: users.id, role: users.role, name: users.name, isActive: users.isActive })
    .from(users).where(eq(users.id, session.user.id)).limit(1)
  if (!user?.isActive || (adminOnly ? user.role !== "admin" : !["admin", "event_staff"].includes(user.role))) {
    throw new EventError(403, "FORBIDDEN")
  }
  return user as { id: string; role: string; name: string }
}

export function requireSameOrigin(req: Request) {
  const origin = req.headers.get("origin")
  if (!origin || origin !== new URL(req.url).origin || req.headers.get("sec-fetch-site") === "cross-site") {
    throw new EventError(403, "INVALID_ORIGIN")
  }
}

export async function issueEventTickets(orderId: string) {
  return issueTickets(db, orderId)
}

export async function revokeOrderTickets(orderId: string) {
  return revokeTickets(db, orderId)
}

export async function listEventProducts(userId: string) {
  return resultRows<any>(await db.execute(sql`
    SELECT p.id, p.name_ar AS "nameAr", p.name_en AS "nameEn",
      p.event_starts_at AS "eventStartsAt", p.event_ends_at AS "eventEndsAt",
      p.event_location AS "eventLocation", p.is_active AS "isActive",
      (SELECT count(*)::int FROM event_tickets t
        JOIN order_items i ON i.id = t.order_item_id JOIN orders o ON o.id = i.order_id
        WHERE t.product_id = p.id AND t.revoked_at IS NULL AND o.status = 'paid') AS "ticketCount",
      (SELECT count(*)::int FROM event_tickets t WHERE t.product_id = p.id
        AND t.checked_in_at IS NOT NULL) AS "attendanceCount",
      (SELECT count(*)::int FROM event_tickets t
        JOIN order_items i ON i.id = t.order_item_id JOIN orders o ON o.id = i.order_id
        WHERE t.product_id = p.id AND t.revoked_at IS NULL AND t.checked_in_at IS NULL
          AND o.status = 'paid') AS "waitingCount"
    FROM products p
    WHERE p.product_type = 'event_ticket' AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = ${userId}::uuid AND u.is_active
      AND (u.role = 'admin' OR (u.role = 'event_staff' AND EXISTS (
        SELECT 1 FROM event_staff_assignments a WHERE a.user_id = u.id AND a.product_id = p.id
      )))
    ) ORDER BY p.event_starts_at DESC
  `))
}

export async function getBuyerTickets(userId: string, cursor?: string, orderId?: string) {
  return db.select({
    id: eventTickets.id, orderItemId: eventTickets.orderItemId, productId: eventTickets.productId,
    userId: eventTickets.userId, ordinal: eventTickets.ordinal, checkedInAt: eventTickets.checkedInAt,
    revokedAt: eventTickets.revokedAt, nameAr: products.nameAr, nameEn: products.nameEn,
    eventStartsAt: products.eventStartsAt, eventEndsAt: products.eventEndsAt,
    eventLocation: products.eventLocation, orderId: orders.id,
  }).from(eventTickets)
    .innerJoin(orderItems, eq(orderItems.id, eventTickets.orderItemId))
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, eventTickets.productId))
    .innerJoin(users, eq(users.id, eventTickets.userId))
    .where(and(eq(eventTickets.userId, userId), eq(orders.status, "paid"), eq(users.isActive, true),
      orderId ? eq(orders.id, orderId) : undefined,
      cursor ? gt(eventTickets.id, cursor) : undefined))
    .orderBy(asc(eventTickets.id)).limit(21)
}

export async function checkInTicket(userId: string, productId: string, code: string) {
  return admitTicket(db, userId, productId, code)
}
