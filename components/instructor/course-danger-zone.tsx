"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { deleteCourseAction } from "@/lib/actions/course"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Trash2, Clock, ShieldCheck, ShieldAlert, CheckCircle2, FileX } from "lucide-react"

type ApprovalStatus = "approved" | "pending" | "rejected" | "draft"

interface CourseDangerZoneProps {
  lang: string
  courseId: string
  isAdmin?: boolean
  isApproved?: boolean | null
  approvedAt?: Date | string | null
  approvalNote?: string | null
  deletionRequested?: boolean | null
  deletionRequestedAt?: Date | string | null
  deletionRequestedReason?: string | null
  deletionReviewedAt?: Date | string | null
  deletionRejectedReason?: string | null
  isPublished?: boolean | null
}

function computeStatus(p: CourseDangerZoneProps): ApprovalStatus {
  if (p.isApproved) return "approved"
  if (p.approvalNote) return "rejected"
  if (!p.isPublished) return "draft"
  return "pending"
}

function fmtDate(v: Date | string | null | undefined) {
  if (!v) return "—"
  const d = typeof v === "string" ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function CourseDangerZone(props: CourseDangerZoneProps) {
  const { lang, courseId, isAdmin = false } = props
  const isAr = lang === "ar"
  const { toast } = useToast()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")

  const status = computeStatus(props)

  const handleDeleteCourse = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteCourseAction(courseId, isAdmin ? undefined : (reason.trim() || undefined))
      if (result.error) {
        toast({
          title: isAr ? "خطأ" : "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        const mode = (result as any).mode
        if (mode === "requested") {
          toast({
            title: isAr ? "تم إرسال طلب الحذف" : "Deletion request sent",
            description: isAr
              ? "ستقوم إدارة المنصة بمراجعة طلبك قريباً، وسيتم إبلاغك بالنتيجة."
              : "Our admin team will review your request shortly and notify you of the outcome.",
          })
          setOpen(false)
          router.refresh()
        } else {
          toast({
            title: isAr ? "تم الحذف" : "Deleted",
            description: isAr ? "تم حذف الدورة نهائياً." : "Course permanently deleted.",
          })
          router.push(`/${lang}/admin/course-reviews`)
        }
      }
    } catch (error) {
      toast({
        title: isAr ? "خطأ" : "Error",
        description: isAr ? "حدث خطأ غير متوقع" : "Unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const BadgeFor = () => {
    if (status === "approved")
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {isAr ? "معتمدة رسمياً" : "Officially Approved"}
        </Badge>
      )
    if (status === "rejected")
      return (
        <Badge variant="destructive">
          <FileX className="h-3 w-3 mr-1" />
          {isAr ? "مرفوضة من الإدارة" : "Rejected by Admin"}
        </Badge>
      )
    if (status === "draft")
      return (
        <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-300">
          {isAr ? "مسودة (غير منشورة)" : "Draft (Unpublished)"}
        </Badge>
      )
    return (
      <Badge className="bg-sky-500 hover:bg-sky-600 text-white">
        <Clock className="h-3 w-3 mr-1" />
        {isAr ? "قيد المراجعة من الإدارة" : "Under Admin Review"}
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      {/* Admin Moderation Status Card */}
      <Card className={
        status === "rejected"
          ? "border-rose-300 bg-rose-50/40"
          : status === "pending"
          ? "border-sky-300 bg-sky-50/40"
          : status === "approved"
          ? "border-emerald-300 bg-emerald-50/40"
          : "border-slate-200 bg-slate-50/40"
      }>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {status === "approved"
              ? <ShieldCheck className="h-5 w-5 text-emerald-600" />
              : status === "rejected"
              ? <ShieldAlert className="h-5 w-5 text-rose-600" />
              : <Clock className="h-5 w-5 text-sky-600" />}
            {isAr ? "حالة الاعتماد الإداري" : "Admin Approval Status"}
            <div className="mr-auto">{BadgeFor()}</div>
          </CardTitle>
          <CardDescription>
            {isAr
              ? "دورات المدربين لا تظهر للطلاب ولا يمكن بدء بث مباشر فيها إلا بعد اعتمادها من إدارة المنصة."
              : "Instructor courses are not visible to students, nor can a live stream start, until approved by admin."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isAr ? "حالة الاعتماد:" : "Approval status:"}</span>
              <span className="font-medium">{
                status === "approved" ? (isAr ? "معتمدة" : "Approved") :
                status === "rejected" ? (isAr ? "مرفوضة" : "Rejected") :
                status === "pending" ? (isAr ? "قيد المراجعة" : "Pending Review") :
                (isAr ? "مسودة" : "Draft")
              }</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isAr ? "تاريخ الاعتماد:" : "Approved on:"}</span>
              <span>{status === "approved" ? fmtDate(props.approvedAt) : "—"}</span>
            </div>
            {props.deletionRequested && (
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Trash2 className="h-3.5 w-3.5 text-amber-600" />
                  {isAr ? "طلب حذف أرسل في:" : "Deletion requested at:"}
                </span>
                <span>{fmtDate(props.deletionRequestedAt)}</span>
              </div>
            )}
            {props.deletionReviewedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isAr ? "مراجعة الطلب في:" : "Review completed at:"}</span>
                <span>{fmtDate(props.deletionReviewedAt)}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {status === "rejected" && props.approvalNote ? (
              <div className="bg-white border border-rose-200 rounded p-3 text-sm">
                <div className="font-medium text-rose-700 mb-1">
                  {isAr ? "سبب الرفض من الإدارة:" : "Admin rejection note:"}
                </div>
                <div className="text-slate-700 whitespace-pre-wrap">{props.approvalNote}</div>
              </div>
            ) : status === "pending" ? (
              <div className="bg-white border border-sky-200 rounded p-3 text-sm text-sky-800">
                {isAr
                  ? "🚀 أرسلت الدورة للمراجعة. بمجرد اعتمادها من الإدارة ستظهر فوراً في الكتالوج العام ويمكن للطلاب الالتحاق بها."
                  : "🚀 Submitted for review. Once approved, the course will appear in public catalog and students can enroll."}
              </div>
            ) : status === "approved" ? (
              <div className="bg-white border border-emerald-200 rounded p-3 text-sm text-emerald-800">
                {isAr
                  ? "✅ معتمدة! الدورة الآن مرئية للجميع والطلاب يستطيعون الالتحاق بها والبدء بالبث المباشر."
                  : "✅ Approved! Course is now public — students can enroll and live stream can start."}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded p-3 text-sm text-slate-600">
                {isAr
                  ? "💡 هذه المسودة غير مرئية لأي شخص. انشرها من إعدادات الدورة ليتم إرسالها للمراجعة الإدارية."
                  : "💡 This draft is not visible to anyone. Publish it in course settings to send it for admin review."}
              </div>
            )}
            {props.deletionRequested && !props.deletionReviewedAt && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                {isAr
                  ? "⏳ يوجد طلب حذف معلق لهذه الدورة بانتظار مراجعة الإدارة. حتى الحل، الدورة مخفية من الكتالوج."
                  : "⏳ Pending deletion request waiting for admin review. Course is hidden from catalog until resolved."}
                {props.deletionRequestedReason ? (
                  <div className="mt-1 text-xs text-amber-700/90">
                    {isAr ? "السبب:" : "Reason:"} {props.deletionRequestedReason}
                  </div>
                ) : null}
              </div>
            )}
            {props.deletionRejectedReason ? (
              <div className="mt-2 bg-rose-50 border border-rose-200 rounded p-3 text-sm text-rose-800">
                {isAr ? "❌ تم رفض طلب الحذف:" : "❌ Deletion request rejected:"} {props.deletionRejectedReason}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            {isAr ? "منطقة الخطر — الحذف" : "Danger Zone — Deletion"}
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? (isAr ? "أنت أدمن — الحذف سينفذ فوراً ولا يمكن التراجع عنه." : "You are admin — deletion executes immediately and is irreversible.")
              : (isAr ? "كمدرب، لا يمكنك حذف الدورة مباشرة؛ سترسل طلباً للإدارة لمراجعته والموافقة عليه قبل التنفيذ." : "As an instructor, you cannot delete the course directly; this submits a request for admin review & approval.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg border-destructive/20 bg-destructive/5 flex-wrap gap-3">
            <div className="min-w-[220px]">
              <h3 className="font-medium text-destructive">
                {isAdmin
                  ? (isAr ? "حذف الدورة نهائياً" : "Permanently delete course")
                  : (isAr ? "طلب حذف الدورة (يحتاج موافقة الإدارة)" : "Request course deletion (requires admin approval)")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isAdmin
                  ? (isAr
                      ? "سيتم حذف الدورة وجميع محتوياتها والطلاب المسجلين بها نهائياً."
                      : "This will permanently delete the course, all content, and enrollments.")
                  : (isAr
                      ? "سيرسل طلبك لإدارة المنصة. إذا وُفِقَ، سيتم حذف الدورة وجميع محتوياتها نهائياً."
                      : "Your request will be sent to admin. If approved, the course and all content will be permanently deleted.")}
              </p>
            </div>
            <AlertDialog open={open} onOpenChange={setOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting || !!props.deletionRequested && !props.deletionReviewedAt}>
                  {isDeleting
                    ? (isAr ? "جاري التنفيذ..." : "Processing...")
                    : isAdmin
                    ? (isAr ? "حذف الدورة نهائياً" : "Delete Permanently")
                    : !!props.deletionRequested && !props.deletionReviewedAt
                    ? (isAr ? "طلب الحذف قيد المراجعة" : "Deletion Request Pending")
                    : (isAr ? "إرسال طلب الحذف للإدارة" : "Send Deletion Request")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{isAr ? "هل أنت متأكد؟" : "Are you sure?"}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isAdmin
                      ? (isAr
                          ? "هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الدورة وجميع البيانات المرتبطة بها نهائياً."
                          : "This action cannot be undone. This will permanently delete the course and all associated data.")
                      : (isAr
                          ? "ستقوم بإرسال طلب حذف للإدارة. حتى الموافقة، ستظل الدورة مخفية من الكتالوج العام."
                          : "You are about to send a deletion request to the admin team. Until approved, the course remains hidden from the catalog.")}
                  </AlertDialogDescription>
                </AlertDialogHeader>

                {!isAdmin && (
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="reason">
                      {isAr ? "سبب طلب الحذف (مستحسن ذكره)" : "Reason for deletion request (recommended)"}
                    </Label>
                    <Textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={
                        isAr
                          ? "مثال: تكرار محتوى مع دورة أخرى / التوقف عن تدريس هذه الدورة / تحديث شامل للمحتوى..."
                          : "e.g. Duplicate content / Stopped teaching this course / Full content refresh..."
                      }
                      rows={4}
                    />
                  </div>
                )}

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteCourse} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting}>
                    {isAdmin
                      ? (isAr ? "نعم، احذف الدورة نهائياً" : "Yes, delete permanently")
                      : (isAr ? "نعم، أرسل طلب الحذف للإدارة" : "Yes, send deletion request")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
