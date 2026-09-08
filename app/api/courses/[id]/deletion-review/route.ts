import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { courses } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac/permissions"

type DeletionAction = "approve" | "reject" | "cancel"

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

    const { action, reason } = (await req.json()) as { action?: DeletionAction; reason?: string }
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
    const cleanReason = reason ? String(reason).slice(0, 1000) : null

    switch (action) {
      case "approve":
        // Admin approved the deletion request — actually hard-delete the course now.
        await db.delete(courses).where(eq(courses.id, courseId))
        return NextResponse.json({ success: true, action, deleted: true })

      case "reject":
        // Admin rejected the deletion. Clear the request and save rejection reason.
        await db
          .update(courses)
          .set({
            deletionRequested: false,
            deletionReviewedBy: session.user.id,
            deletionReviewedAt: now,
            deletionRejectedReason: cleanReason ?? "Deletion request rejected by admin",
          })
          .where(eq(courses.id, courseId))
        break

      case "cancel":
        // Admin cancelled the review without deleting/rejecting (useful for re-queuing).
        await db
          .update(courses)
          .set({
            deletionReviewedBy: session.user.id,
            deletionReviewedAt: now,
            deletionRejectedReason: cleanReason ?? "Deletion request cancelled by admin",
          })
          .where(eq(courses.id, courseId))
        break

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    return NextResponse.json({ success: true, action, deleted: false })
  } catch (error) {
    console.error("[DELETION_REVIEW_PATCH]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
