import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { getBuyerTickets } from "@/lib/events"
import { appleWalletAvailable, createAppleWalletPass, walletTicketUsable } from "@/lib/apple-wallet"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" }

export async function GET(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401, headers })
    const { ticketId } = await params
    if (!z.string().uuid().safeParse(ticketId).success) return NextResponse.json({ error: "INVALID_DATA" }, { status: 400, headers })
    const [ticket] = await getBuyerTickets(user.id, undefined, undefined, ticketId)
    if (!ticket) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers })
    if (!walletTicketUsable(ticket)) return NextResponse.json({ error: "TICKET_UNAVAILABLE" }, { status: 409, headers })
    if (!appleWalletAvailable()) return NextResponse.json({ error: "WALLET_NOT_CONFIGURED" }, { status: 503, headers })
    const lang = new URL(req.url).searchParams.get("lang") === "ar" ? "ar" : "en"
    const pass = await createAppleWalletPass(ticket, lang)
    return new Response(new Uint8Array(pass), {
      headers: { ...headers, "Content-Type": "application/vnd.apple.pkpass", "Content-Disposition": `attachment; filename="neon-ticket-${ticketId}.pkpass"` },
    })
  } catch {
    console.error("Apple Wallet ticket generation failed")
    return NextResponse.json({ error: "WALLET_GENERATION_FAILED" }, { status: 500, headers })
  }
}
