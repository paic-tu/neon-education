import { NextResponse } from "next/server"
import QRCode from "qrcode"
import { getCurrentUser } from "@/lib/auth"
import { getBuyerTickets } from "@/lib/events"
import { ticketCode } from "@/lib/event-ticket-code"
import { z } from "zod"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
    const params = new URL(req.url).searchParams
    const cursor = params.get("cursor") || undefined
    const orderId = params.get("orderId") || undefined
    if ((cursor && !z.string().uuid().safeParse(cursor).success)
      || (orderId && !z.string().uuid().safeParse(orderId).success)) {
      return NextResponse.json({ error: "INVALID_DATA" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    const tickets = await getBuyerTickets(user.id, cursor, orderId)
    const page = tickets.slice(0, 20)
    const data = await Promise.all(page.map(async (ticket: any) => {
      const code = !ticket.revokedAt && !ticket.checkedInAt ? ticketCode(ticket) : null
      const qr = code ? await QRCode.toDataURL(code, { width: 320, margin: 4, errorCorrectionLevel: "M" }) : null
      const { userId, orderItemId, ...publicTicket } = ticket
      return { ...publicTicket, code, qr }
    }))
    return NextResponse.json({ tickets: data, nextCursor: tickets.length > 20 ? page[page.length - 1].id : null }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } })
  } catch {
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
