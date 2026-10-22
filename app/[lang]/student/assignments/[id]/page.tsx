import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { assignmentSubmissions, assignments, courses, enrollments, orderItems, orders } from "@/lib/db/schema"
import { getCourseById, getEnrollment } from "@/lib/db/queries"
import { and, count, eq, inArray } from "drizzle-orm"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AssignmentSubmitForm } from "@/components/assignments/assignment-submit-form"
import { CourseShell } from "@/components/student/course/course-shell"
import { CalendarClock, CheckCircle2, ClipboardList, Clock, HardDrive, Info, Upload, BookOpen } from "lucide-react"

async function canAccessCourse(userId: string, courseId: string) {
  const enrollment = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
    columns: { id: true },
  })
  if (!enrollment) return false

  const course = await db.query.courses.findFirst({
    where: eq(courses.id, courseId),
    columns: { isFree: true, price: true },
  })
  if (!course) return false
  if (course.isFree) return true

  const priceNumber = Number.parseFloat(String(course.price))
  const isPaidCourse = Number.isFinite(priceNumber) && priceNumber > 0
  if (!isPaidCourse) return true

  const rows = await db
    .select({ c: count() })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.userId, userId), inArray(orders.status, ["paid", "shipped", "delivered"]), eq(orderItems.courseId, courseId)))
  return (rows[0]?.c ?? 0) > 0
}

function formatBytes(bytes: number | null | undefined, isAr: boolean) {
  if (!bytes || bytes <= 0) return "—"
  const units = isAr ? ["بايت", "ك.ب", "م.ب", "ج.ب"] : ["B", "KB", "MB", "GB"]
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  const rounded = value >= 10 || i === 0 ? Math.round(value).toString() : value.toFixed(1)
  return `${rounded} ${units[i]}`
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—"
  return new Date(date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default async function StudentAssignmentDetailsPage(props: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await props.params
  const isAr = lang === "ar"
  const user = await getCurrentUser()
  if (!user) redirect(`/${lang}/auth/login`)
  if (user.role !== "student") redirect(`/${lang}/dashboard`)

  const a = await db
    .select({
      id: assignments.id,
      courseId: assignments.courseId,
      titleEn: assignments.titleEn,
      titleAr: assignments.titleAr,
      descriptionEn: assignments.descriptionEn,
      descriptionAr: assignments.descriptionAr,
      dueAt: assignments.dueAt,
      maxBytes: assignments.maxFileSizeBytes,
      courseTitleEn: courses.titleEn,
      courseTitleAr: courses.titleAr,
    })
    .from(assignments)
    .innerJoin(courses, eq(assignments.courseId, courses.id))
    .where(and(eq(assignments.id, id), eq(assignments.isPublished, true)))
    .limit(1)

  const assignment = a[0]
  if (!assignment) return <div>{isAr ? "غير موجود" : "Not found"}</div>

  const allowed = await canAccessCourse(user.id, assignment.courseId)
  if (!allowed) redirect(`/${lang}/courses/${assignment.courseId}`)

  // Fetch course + enrollment the same way the course-shell layout does, so
  // this page can wrap its content in the same CourseShell (same courseId
  // already derived above from the assignment record itself).
  const [course, enrollment] = await Promise.all([
    getCourseById(assignment.courseId),
    getEnrollment(user.id, assignment.courseId),
  ])

  let submission:
    | {
        textContent?: string | null
        fileUrl?: string | null
        fileName?: string | null
        fileSize?: number | null
        submittedAt: Date | null
        status: string
      }
    | null = null

  try {
    submission = await db.query.assignmentSubmissions.findFirst({
      where: and(eq(assignmentSubmissions.assignmentId, id), eq(assignmentSubmissions.userId, user.id)),
      columns: { textContent: true, fileUrl: true, fileName: true, fileSize: true, submittedAt: true, status: true },
    })
  } catch {
    submission = await db.query.assignmentSubmissions.findFirst({
      where: and(eq(assignmentSubmissions.assignmentId, id), eq(assignmentSubmissions.userId, user.id)),
      columns: { fileUrl: true, fileName: true, fileSize: true, submittedAt: true, status: true },
    })
  }

  const title = isAr ? assignment.titleAr : assignment.titleEn
  const courseTitle = isAr ? assignment.courseTitleAr : assignment.courseTitleEn
  const description = isAr ? assignment.descriptionAr : assignment.descriptionEn

  const dueDate = assignment.dueAt ? new Date(assignment.dueAt) : null
  const isSubmitted = Boolean(submission)
  const isOverdue = Boolean(dueDate && dueDate.getTime() < Date.now() && !isSubmitted)

  const statusLabel = isSubmitted
    ? isAr
      ? "تم التسليم"
      : "Submitted"
    : isOverdue
      ? isAr
        ? "متأخر"
        : "Late"
      : isAr
        ? "بانتظار التسليم"
        : "Awaiting submission"
  const statusVariant: "default" | "destructive" | "secondary" = isSubmitted ? "default" : isOverdue ? "destructive" : "secondary"

  let timingNote: string | null = null
  if (dueDate && !isSubmitted) {
    const diffDays = Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000)
    if (diffDays > 1) timingNote = isAr ? `متبقٍ ${diffDays} يوم` : `${diffDays} days left`
    else if (diffDays === 1) timingNote = isAr ? "متبقٍ يوم واحد" : "1 day left"
    else if (diffDays === 0) timingNote = isAr ? "ينتهي اليوم" : "Due today"
    else timingNote = isAr ? `متأخر بـ ${Math.abs(diffDays)} يوم` : `${Math.abs(diffDays)} days overdue`
  }

  const stats = [
    { key: "status", label: isAr ? "الحالة" : "Status", value: statusLabel, icon: CheckCircle2 },
    { key: "due", label: isAr ? "آخر موعد" : "Due date", value: formatDate(dueDate), icon: CalendarClock },
    { key: "size", label: isAr ? "الحجم الأقصى" : "Max file size", value: formatBytes(assignment.maxBytes, isAr), icon: HardDrive },
    ...(isSubmitted
      ? [{ key: "submitted", label: isAr ? "آخر تسليم" : "Last submitted", value: formatDate(submission?.submittedAt), icon: Clock }]
      : []),
  ]

  const content = (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-primary/5 p-6 sm:p-7">
        <div className="pointer-events-none absolute -end-16 -top-20 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -start-12 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/20">
              <ClipboardList className="h-7 w-7" />
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{courseTitle}</span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h1>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Badge variant={statusVariant} className="gap-1.5 px-2.5 py-1">
                  {isSubmitted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  {statusLabel}
                </Badge>

                {dueDate && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {formatDate(dueDate)}
                  </span>
                )}

                {timingNote && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                      isOverdue
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-primary/25 bg-primary/10 text-primary"
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {timingNote}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${stats.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.key} className="rounded-xl border bg-background/70 p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {stat.label}
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold" title={stat.value}>
                    {stat.value}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Details */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-primary" />
            {isAr ? "تفاصيل الواجب" : "Assignment details"}
          </CardTitle>
        </CardHeader>
        <CardContent dir={isAr ? "rtl" : "ltr"}>
          {description ? (
            <div className="rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">{description}</div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isAr ? "لا يوجد وصف مرفق لهذا الواجب." : "No description was provided for this assignment."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Submission */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-primary" />
            {isAr ? "تسليم الواجب" : "Submit your work"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AssignmentSubmitForm
            lang={lang}
            assignmentId={id}
            maxBytes={assignment.maxBytes}
            existingFileUrl={submission?.fileUrl || null}
            existingFileName={submission?.fileName || null}
            existingTextContent={submission?.textContent || null}
          />
        </CardContent>
      </Card>
    </div>
  )

  if (!course) return content

  return (
    <CourseShell
      lang={lang}
      courseId={assignment.courseId}
      course={{
        titleAr: course.titleAr,
        titleEn: course.titleEn,
        thumbnailUrl: course.thumbnailUrl,
      }}
      progress={enrollment?.progress ?? 0}
    >
      {content}
    </CourseShell>
  )
}
