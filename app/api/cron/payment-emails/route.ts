import { NextResponse } from "next/server"
import { getEmailRecoveryHealth, isEmailRecoveryAuthorized, runEmailRecovery } from "@/lib/payments/email-recovery"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" }
  if (!isEmailRecoveryAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers })
  }
  try {
    const result = await runEmailRecovery()
    if (result.skipped) return NextResponse.json(result, { headers })
    const health = await getEmailRecoveryHealth()
    const unhealthy = result.domainStatus !== "verified" || result.failed > 0 || health.deliveryIssues > 0 || health.review > 0 || health.pending > 0
    return NextResponse.json({ ...result, health }, { status: unhealthy ? 503 : 200, headers })
  } catch {
    console.error("Payment email recovery failed")
    return NextResponse.json({ error: "Email recovery failed" }, { status: 503, headers })
  }
}
