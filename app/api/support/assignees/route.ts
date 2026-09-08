import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { listSupportAssignees } from "@/lib/db/support-queries"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role || "student"
    const allowedRoles = ["admin", "manager", "support"]
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const assignees = await listSupportAssignees()

    return NextResponse.json({ assignees })
  } catch (error) {
    console.error("[SUPPORT_ASSIGNEES_GET]", error)
    return NextResponse.json({ assignees: [] })
  }
}
