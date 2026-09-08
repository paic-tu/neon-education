import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { supportTickets, supportTicketMessages } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac/permissions"
import { z } from "zod"
import { listTicketMessages } from "@/lib/db/support-queries"

const createMessageSchema = z.object({
  content: z.string().min(1),
  attachments: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      size: z.number().optional(),
      mimeType: z.string().optional(),
    })
  ).default([]),
  isInternal: z.boolean().default(false),
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

    const messages = await listTicketMessages(userId, userRole, ticketId)

    return NextResponse.json({ messages })
  } catch (error) {
    console.error("[SUPPORT_TICKET_MESSAGES_GET]", error)
    return NextResponse.json({ messages: [] })
  }
}

export async function POST(
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
    const canManageAll = hasPermission(userRole as any, "support:manage") || hasPermission(userRole as any, "support:write")

    const ticket = await db.query.supportTickets.findFirst({
      where: eq(supportTickets.id, ticketId),
      columns: {
        id: true,
        createdById: true,
        assignedToId: true,
        status: true,
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const isParticipant = ticket.createdById === userId || ticket.assignedToId === userId
    if (!canManageAll && !isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (ticket.status === "closed") {
      return NextResponse.json(
        { error: "Cannot add message to a closed ticket" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parseResult = createMessageSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = parseResult.data

    if (data.isInternal && !hasPermission(userRole as any, "support:manage")) {
      return NextResponse.json(
        { error: "Only support staff can mark messages as internal" },
        { status: 403 }
      )
    }

    const [message] = await db
      .insert(supportTicketMessages)
      .values({
        ticketId,
        senderId: userId,
        content: data.content,
        attachments: data.attachments,
        isInternal: data.isInternal,
      })
      .returning()

    await db
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId))

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error("[SUPPORT_TICKET_MESSAGES_POST]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
