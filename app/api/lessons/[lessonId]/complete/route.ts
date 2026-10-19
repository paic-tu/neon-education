import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { enrollments, lessons, courses, certificates } from "@/lib/db/schema"
import { and, eq, count } from "drizzle-orm"
import { sendMail } from "@/lib/mail"
import { getSiteSettings } from "@/lib/db/queries"
import { renderCourseCompletedEmail, renderErrorAlertEmail } from "@/lib/emails"

const CompleteSchema = z.object({
  courseId: z.string().min(1),
  complete: z.boolean(),
})

export async function POST(request: Request, props: { params: Promise<{ lessonId: string }> }) {
  const params = await props.params
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { courseId, complete } = CompleteSchema.parse(body)
    const lessonId = params.lessonId

    if (!lessonId) {
      return NextResponse.json({ error: "Invalid lesson ID" }, { status: 400 })
    }

    // Get current enrollment
    const enrollment = await db.query.enrollments.findFirst({
      where: and(
        eq(enrollments.userId, user.id),
        eq(enrollments.courseId, courseId)
      ),
      columns: {
        completedLessons: true,
      }
    })

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })
    }

    let completedLessons: string[] = enrollment.completedLessons || []

    // Add or remove lesson from completed list
    if (complete && !completedLessons.includes(lessonId)) {
      completedLessons.push(lessonId)
    } else if (!complete && completedLessons.includes(lessonId)) {
      completedLessons = completedLessons.filter((id: string) => id !== lessonId)
    }

    // Get total lessons in course
    const totalLessonsResult = await db
      .select({ count: count() })
      .from(lessons)
      .where(eq(lessons.courseId, courseId))

    const totalLessons = Number(totalLessonsResult[0]?.count || 1)
    const progressPct = Math.round((completedLessons.length / totalLessons) * 100)

    // Update enrollment and check certificate
    await db.transaction(async (tx) => {
      await tx.update(enrollments)
        .set({
          completedLessons: completedLessons,
          progress: progressPct,
          lastAccessedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(enrollments.userId, user.id),
          eq(enrollments.courseId, courseId)
        ))

      // Auto-issue certificate if 100% complete
      if (progressPct === 100 && complete) {
        const course = await tx.query.courses.findFirst({
          where: eq(courses.id, courseId),
          columns: {
            titleEn: true,
            titleAr: true,
          }
        })

        if (course) {
          const certNumber = `CERT-${Date.now()}-${user.id}-${courseId}`
          
          await tx.insert(certificates)
            .values({
              userId: user.id,
              courseId: courseId,
              certificateNumber: certNumber,
              titleEn: course.titleEn,
              titleAr: course.titleAr,
              status: "issued",
              issuedAt: new Date(),
            })
            .onConflictDoNothing()

          // Send Course Completed Email
          try {
            const settings = await getSiteSettings()
            const { html, text } = await renderCourseCompletedEmail({
              language: "ar",
              userName: user.name || "",
              certificateUrl: `${process.env.NEXT_PUBLIC_APP_URL}/ar/portal/certificates`,
            })
            await sendMail({
              to: user.email,
              subject: `تهانينا! إكمال الكورس - ${settings.siteName}`,
              html,
              text,
            })
          } catch (emailErr) {
            console.error("[v0] Error sending course completed email:", emailErr)
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      progress: progressPct,
      completedLessons,
      message: complete ? "Lesson marked complete" : "Lesson marked incomplete",
    })
  } catch (error) {
    console.error("[v0] Error marking lesson complete:", error)
    // Send Error Alert Email
    try {
      const errUser = await getCurrentUser()
      if (errUser?.email) {
        const { html, text } = await renderErrorAlertEmail({
          language: "ar",
          supportUrl: `${process.env.NEXT_PUBLIC_APP_URL}/ar/support`,
        })
        await sendMail({
          to: errUser.email,
          subject: `حدث خطأ أثناء تحديث التقدم - ${(await getSiteSettings()).siteName}`,
          html,
          text,
        })
      }
    } catch (emailErr) {
      console.error("[v0] Error sending error alert email:", emailErr)
    }
    return NextResponse.json({ error: "Failed to update lesson completion" }, { status: 500 })
  }
}
