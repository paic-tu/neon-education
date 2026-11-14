import { NextResponse } from "next/server"
import { getUnreadMessageCount } from "@/lib/actions/chat"

export const dynamic = "force-dynamic"

export async function GET() {
  const count = await getUnreadMessageCount()
  return NextResponse.json({ count }, { headers: { "Cache-Control": "private, no-store" } })
}
