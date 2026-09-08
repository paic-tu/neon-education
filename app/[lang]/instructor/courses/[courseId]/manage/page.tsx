import { auth } from "@/lib/auth"
import { notFound, redirect } from "next/navigation"
import { db } from "@/lib/db"
import { courses } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { CourseDangerZone } from "@/components/instructor/course-danger-zone"

export default async function InstructorCourseManagePage({
  params,
}: {
  params: Promise<{ lang: string; courseId: string }>
}) {
  const { lang, courseId } = await params
  const session = await auth()

  if (!session?.user?.id || (session.user.role !== "instructor" && session.user.role !== "admin" && session.user.role !== "manager")) {
    redirect(`/${lang}/auth/login`)
  }

  const role = session.user.role
  const isStaff = role === "admin" || role === "manager"

  const course = await db.query.courses.findFirst({
    where: isStaff
      ? eq(courses.id, courseId)
      : and(eq(courses.id, courseId), eq(courses.instructorId, session.user.id)),
  })

  if (!course) {
    notFound()
  }

  return (
    <CourseDangerZone
      lang={lang}
      courseId={courseId}
      isAdmin={isStaff}
      isPublished={course.isPublished}
      isApproved={course.isApproved}
      approvedAt={course.approvedAt}
      approvedBy={course.approvedBy}
      approvalNote={course.approvalNote}
      deletionRequested={course.deletionRequested}
      deletionRequestedAt={course.deletionRequestedAt}
      deletionRequestedReason={course.deletionRequestedReason}
      deletionReviewedBy={course.deletionReviewedBy}
      deletionReviewedAt={course.deletionReviewedAt}
      deletionRejectedReason={course.deletionRejectedReason}
    />
  )
}
