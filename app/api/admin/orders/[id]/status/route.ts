import { type NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac/require-permission"
import { z } from "zod"
import { db } from "@/lib/db"
import { cartItems, carts, enrollments, orders, orderItems } from "@/lib/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { logAudit, type AuditResource } from "@/lib/audit/audit-logger"
import { revokeOrderTickets, requireSameOrigin } from "@/lib/events"

const updateStatusSchema = z.object({
  status: z.enum(["pending", "paid", "shipped", "delivered", "cancelled"]),
  fulfill: z.boolean().optional().default(false),
})

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    await requirePermission("orders:write")
    requireSameOrigin(request)

    const orderId = params.id
    const body = await request.json()
    const { status, fulfill } = updateStatusSchema.parse(body)

    // Get before state
    const existing = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const now = new Date()
    const eventItem = await db.query.orderItems.findFirst({
      where: and(eq(orderItems.orderId, orderId), eq(orderItems.isEventTicket, true)),
      columns: { id: true },
    })
    if (eventItem && status !== "cancelled") {
      return NextResponse.json({ error: "Event ticket payment must be confirmed by the gateway" }, { status: 403 })
    }

    if (status === "paid" && fulfill) {
      const order = await db.query.orders.findFirst({
        where: (t, { eq }) => eq(t.id, orderId),
        with: { items: { columns: { courseId: true } } },
        columns: { id: true, userId: true, paidAt: true, paymentProvider: true, status: true },
      })

      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

      const courseIds = (order.items || [])
        .map((it: any) => it.courseId)
        .filter(Boolean)
        .map((v: any) => String(v))

      if (courseIds.length > 0) {
        const existingEnrollments = await db
          .select({ courseId: enrollments.courseId })
          .from(enrollments)
          .where(and(eq(enrollments.userId, order.userId), inArray(enrollments.courseId, courseIds)))

        const existingSet = new Set(existingEnrollments.map((e) => String(e.courseId)))
        const toInsert = courseIds.filter((cid) => !existingSet.has(cid))
        if (toInsert.length > 0) {
          await db.insert(enrollments).values(
            toInsert.map((courseId) => ({
              userId: order.userId,
              courseId,
              status: "active",
            })),
          )
        }
      }

      const userCarts = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, order.userId))
      const cartIds = userCarts.map((c) => c.id)
      if (cartIds.length > 0) {
        await db.delete(cartItems).where(inArray(cartItems.cartId, cartIds))
      }
    }

    // Update order status
    const result = await db
      .update(orders)
      .set({
        status: status,
        paidAt: status === "paid" ? (existing[0].paidAt ?? now) : existing[0].paidAt,
        paymentProvider: status === "paid" ? (existing[0].paymentProvider ?? "manual") : existing[0].paymentProvider,
        gatewayStatus: status === "paid" ? (existing[0].gatewayStatus ?? "MANUAL_PAID") : existing[0].gatewayStatus,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId))
      .returning()

    if (eventItem && status === "cancelled") await revokeOrderTickets(orderId)

    // Log audit
    await logAudit({
      action: "update",
      resource: "order" as AuditResource,
      resourceId: orderId,
      changes: {
        before: existing[0],
        after: result[0],
      },
    })

    return NextResponse.json(result[0])
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 })
    }
    console.error("[v0] Error updating order:", error)
    return NextResponse.json({ error: error.message }, { status: error.name === "ForbiddenError" ? 403 : 500 })
  }
}
