import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAdminCoursesForReview } from "@/lib/db/queries"
import { hasPermission } from "@/lib/rbac/permissions"
import { ApprovalTable, type ReviewCourseRow } from "./components/approval-table"
import { DeletionRequestsTable, type DeletionRequestRow } from "./components/deletion-requests-table"
import { BookCheck, Trash2, Clock, CheckCircle2, AlertOctagon, FileX } from "lucide-react"

export default async function AdminCourseReviewsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const session = await auth()
  const isAr = lang === "ar"

  if (!session?.user?.id) {
    redirect(`/${lang}/auth/login`)
  }

  const role = (session.user as any).role || "student"
  if (
    (role !== "admin" && role !== "manager") ||
    !hasPermission(role, "courses:approve")
  ) {
    redirect(`/${lang}/access-denied`)
  }

  const raw = await getAdminCoursesForReview()
  const allRows = (raw as unknown) as ReviewCourseRow[]

  function getApprovalStatus(r: ReviewCourseRow) {
    if (r.isApproved) return "approved"
    if (r.approvalNote) return "rejected"
    if (!r.isPublished) return "draft"
    return "pending"
  }

  const pending = allRows.filter((r) => getApprovalStatus(r) === "pending")
  const approved = allRows.filter((r) => getApprovalStatus(r) === "approved")
  const rejected = allRows.filter((r) => getApprovalStatus(r) === "rejected")
  const drafts = allRows.filter((r) => getApprovalStatus(r) === "draft")
  const deletionPending = allRows.filter(
    (r) => r.deletionRequested && !r.deletionReviewedAt
  )
  const deletionAll = allRows.filter((r) => r.deletionRequested)

  const delRows: DeletionRequestRow[] = deletionAll.map((r) => ({
    id: r.id,
    titleAr: r.titleAr,
    titleEn: r.titleEn,
    slug: r.slug,
    thumbnailUrl: r.thumbnailUrl,
    deletionRequested: r.deletionRequested,
    deletionRequestedAt: r.deletionRequestedAt,
    deletionRequestedReason: r.deletionRequestedReason,
    deletionReviewedAt: r.deletionReviewedAt,
    deletionRejectedReason: r.deletionRejectedReason,
    instructorId: r.instructorId,
    instructorName: r.instructorName,
    instructorEmail: r.instructorEmail,
    isApproved: r.isApproved,
    createdAt: r.createdAt,
  }))

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {isAr ? "مراجعة الدورات والموافقات الإدارية" : "Course Reviews & Admin Approvals"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isAr
              ? "اعتماد دورات المدربين رسمياً، وسحب الاعتماد، ومراجعة طلبات الحذف قبل تنفيذها نهائياً."
              : "Officially approve instructor courses, revoke approval, and review deletion requests before final execution."}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 py-1.5 px-3">
            <Clock className="h-3.5 w-3.5 mr-1" />
            {pending.length} {isAr ? "بانتظار المراجعة" : "Pending"}
          </Badge>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 py-1.5 px-3">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            {approved.length} {isAr ? "معتمدة" : "Approved"}
          </Badge>
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 py-1.5 px-3">
            <FileX className="h-3.5 w-3.5 mr-1" />
            {rejected.length} {isAr ? "مرفوضة" : "Rejected"}
          </Badge>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 py-1.5 px-3">
            <AlertOctagon className="h-3.5 w-3.5 mr-1" />
            {deletionPending.length} {isAr ? "طلبات حذف" : "Deletion requests"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-sky-200 bg-sky-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-sky-600" />
              {isAr ? "قيد المراجعة" : "Pending Review"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-sky-700">{pending.length}</div>
            <p className="text-xs text-sky-600/80 mt-1">
              {isAr ? "الدورات التي نشرها المدربون وتنتظر موافقتك." : "Courses published by instructors waiting for your approval."}
            </p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {isAr ? "معتمدة" : "Approved"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700">{approved.length}</div>
            <p className="text-xs text-emerald-600/80 mt-1">
              {isAr ? "الدورات المعتمدة ومرئية في الكتالوج العام." : "Approved and visible in public catalog."}
            </p>
          </CardContent>
        </Card>
        <Card className="border-rose-200 bg-rose-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileX className="h-4 w-4 text-rose-600" />
              {isAr ? "مرفوضة" : "Rejected"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-700">{rejected.length}</div>
            <p className="text-xs text-rose-600/80 mt-1">
              {isAr ? "الدورات التي تم رفضها مع ملاحظات للمدرب." : "Courses rejected with notes for the instructor."}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookCheck className="h-4 w-4 text-slate-600" />
              {isAr ? "مسودات" : "Drafts"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-700">{drafts.length}</div>
            <p className="text-xs text-slate-600/80 mt-1">
              {isAr ? "لم يتم نشرها بعد بواسطة المدرب." : "Not yet published by instructor."}
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trash2 className="h-4 w-4 text-amber-700" />
              {isAr ? "طلبات حذف" : "Deletion requests"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700">{deletionPending.length}</div>
            <p className="text-xs text-amber-700/80 mt-1">
              {isAr ? "تتطلب موافقة الأدمن على الحذف النهائي." : "Require admin approval for final deletion."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-300/60 shadow-[0_0_0_3px_rgba(14,165,233,0.05)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BookCheck className="h-5 w-5 text-sky-600" />
            {isAr ? "اعتماد ورفض الدورات التدريبية" : "Course Approval / Rejection"}
          </CardTitle>
          <CardDescription>
            {isAr
              ? "الموافقة على دورة تعني ظهورها فوراً في الكتالوج العام للطلاب، بينما الرفض مع سبب يعيدها للمدرب للتصحيح."
              : "Approving a course makes it instantly visible in the public catalog. Reject with a reason sends it back to the instructor."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApprovalTable rows={allRows} isAr={isAr} lang={lang} />
        </CardContent>
      </Card>

      <Card className="border-amber-300/60 shadow-[0_0_0_3px_rgba(245,158,11,0.05)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-amber-700" />
            {isAr ? "طلبات حذف الدورات (تتطلب موافقة الأدمن)" : "Course Deletion Requests (Admin approval required)"}
          </CardTitle>
          <CardDescription>
            {isAr
              ? "لا يمكن للمدرب حذف دوراته مباشرة؛ تظهر هنا أولاً لمراجعتك. يمكنك إما رفض الطلب (تعود للمدرب) أو الموافقة (يتم حذف الدورة نهائياً)."
              : "Instructors cannot delete their courses directly; requests land here first. Reject to return it to the instructor, or approve to permanently delete the course."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeletionRequestsTable rows={delRows} isAr={isAr} lang={lang} />
        </CardContent>
      </Card>
    </div>
  )
}
