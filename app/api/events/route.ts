import { NextResponse } from "next/server"
import { z } from "zod"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { EventError, listEventProducts, requireEventUser, resultRows } from "@/lib/events"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const user = await requireEventUser()
    const events = await listEventProducts(user.id)
    const requestedId = new URL(req.url).searchParams.get("productId")
    let attendance: any[] = []
    if (requestedId) {
      if (!z.string().uuid().safeParse(requestedId).success) throw new EventError(400, "INVALID_DATA")
      if (!events.some((event) => event.id === requestedId)) throw new EventError(403, "FORBIDDEN")
      attendance = resultRows(await db.execute(sql`
        SELECT t.id, t.checked_in_at AS "checkedInAt", u.name AS "attendeeName", staff.name AS "staffName",
          t.ticket_number AS "ticketNumber", i.selected_add_ons AS "addOns"
        FROM event_tickets t JOIN users u ON u.id = t.user_id
        JOIN order_items i ON i.id = t.order_item_id
        LEFT JOIN users staff ON staff.id = t.checked_in_by
        WHERE t.product_id = ${requestedId}::uuid AND t.checked_in_at IS NOT NULL
        ORDER BY t.checked_in_at DESC LIMIT 100
      `))
    }
    let staff: any[] = []
    let assignments: any[] = []
    if (user.role === "admin") {
      staff = resultRows(await db.execute(sql`
        SELECT id, name, email FROM users WHERE role = 'event_staff' AND is_active ORDER BY name LIMIT 500
      `))
      assignments = resultRows(await db.execute(sql`
        SELECT product_id AS "productId", user_id AS "userId" FROM event_staff_assignments
      `))
    }
    return NextResponse.json({
      events, attendance, staff, assignments, isAdmin: user.role === "admin",
      ...(user.role === "admin" ? { paymentReady: Boolean(
        process.env.STREAM_API_KEY_BASE64 || (process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET)) } : {}),
    },
      { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    const e = error instanceof EventError ? error : new EventError(500, "SERVER_ERROR")
    return NextResponse.json({ error: e.code }, { status: e.status, headers: { "Cache-Control": "no-store" } })
  }
}
