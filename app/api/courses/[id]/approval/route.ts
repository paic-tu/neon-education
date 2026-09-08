import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { courses } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac/permissions"

type ApprovalAction = "approve" | "reject" | "unpublish" | "revoke"

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id: courseId } = await props.params

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = (session.user as any).role || "student"
    if ((role !== "admin" && role !== "manager") || !hasPermission(role, "courses:approve")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { action, note } = (await req.json()) as { action?: ApprovalAction; note?: string }
    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 })
    }

    const current = await db.query.courses.findFirst({
      where: eq(courses.id, courseId),
    })
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const now = new Date()
    const cleanNote = note ? String(note).slice(0, 1000) : null

    switch (action) {
      case "approve":
        await db
          .update(courses)
          .set({
            isApproved: true,
            approvedAt: now,
            approvedBy: session.user.id,
            approvalNote: cleanNote,
          })
          .where(eq(courses.id, courseId))
        break

      case "reject":
        await db
          .update(courses)
          .set({
            isApproved: false,
            approvedAt: now,
            approvedBy: session.user.id,
            approvalNote: cleanNote ?? "Rejected by admin",
          })
          .where(eq(courses.id, courseId))
        break

      case "revoke":
      case "unpublish":
        await db
          .update(courses)
          .set({
            isApproved: false,
            approvedAt: now,
            approvedBy: session.user.id,
            approvalNote: cleanNote ?? "Approval revoked by admin",
          })
          .where(eq(courses.id, courseId))
        break

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    return NextResponse.json({ success: true, action })
  } catch (error) {
    console.error("[COURSE_APPROVAL_PATCH]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
