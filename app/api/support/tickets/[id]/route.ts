import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { supportTickets, supportTicketMessages, users } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac/permissions"
import { z } from "zod"
import {
  getSupportTicketById,
  listTicketMessages,
} from "@/lib/db/support-queries"

const updateTicketSchema = z.object({
  status: z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]).optional(),
  assignedToId: z.string().uuid().optional().nullable(),
})

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: ticketId } = await props.params
    const userRole = (session.user as any).role || "student"
    const userId = session.user.id

    const ticket = await getSupportTicketById(userId, userRole, ticketId)

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const messages = await listTicketMessages(userId, userRole, ticketId)

    return NextResponse.json({ ticket, messages })
  } catch (error) {
    console.error("[SUPPORT_TICKET_GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role || "student"
    if (!hasPermission(userRole as any, "support:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: ticketId } = await props.params

    const body = await request.json()
    const parseResult = updateTicketSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = parseResult.data

    const existingTicket = await db.query.supportTickets.findFirst({
      where: eq(supportTickets.id, ticketId),
      columns: { id: true },
    })

    if (!existingTicket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    if (data.assignedToId) {
      const assigneeExists = await db.query.users.findFirst({
        where: eq(users.id, data.assignedToId),
        columns: { id: true },
      })
      if (!assigneeExists) {
        return NextResponse.json({ error: "Assigned user not found" }, { status: 404 })
      }
    }

    const updateData: any = {}
    const now = new Date()

    if (data.status !== undefined) {
      updateData.status = data.status
      if (data.status === "resolved") {
        updateData.resolvedAt = now
      }
      if (data.status === "closed") {
        updateData.closedAt = now
      }
    }
    if ("assignedToId" in data) {
      updateData.assignedToId = data.assignedToId
    }
    updateData.updatedAt = now

    const [updatedTicket] = await db
      .update(supportTickets)
      .set(updateData)
      .where(eq(supportTickets.id, ticketId))
      .returning()

    return NextResponse.json({ ticket: updatedTicket })
  } catch (error) {
    console.error("[SUPPORT_TICKET_PATCH]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
