import { NextResponse } from "next/server"
import { z } from "zod"
import { checkInTicket, EventError, requireEventUser, requireSameOrigin } from "@/lib/events"

const scanSchema = z.object({ productId: z.string().uuid(), code: z.string().trim().min(1).max(160) }).strict()

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)
    const user = await requireEventUser()
    if (Number(req.headers.get("content-length") || 0) > 2048) throw new EventError(413, "INVALID_DATA")
    const raw = await req.text()
    if (raw.length > 2048) throw new EventError(413, "INVALID_DATA")
    let json: unknown
    try { json = JSON.parse(raw) } catch { throw new EventError(400, "INVALID_DATA") }
    const body = scanSchema.safeParse(json)
    if (!body.success) throw new EventError(400, "INVALID_DATA")
    const result = await checkInTicket(user.id, body.data.productId, body.data.code)
    return NextResponse.json({ success: true, ...result }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const e = error instanceof EventError ? error : new EventError(500, "SERVER_ERROR")
    return NextResponse.json({ error: e.code }, {
      status: e.status,
      headers: { "Cache-Control": "no-store", ...(e.status === 429 ? { "Retry-After": "60" } : {}) },
    })
  }
}
