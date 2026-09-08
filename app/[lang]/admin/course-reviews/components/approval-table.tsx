"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Check, X, Clock, Eye, FileText, AlertTriangle } from "lucide-react"
import Image from "next/image"

export type ReviewCourseRow = {
  id: string
  titleAr: string
  titleEn: string
  slug: string
  thumbnailUrl: string | null
  isPublished: boolean
  isLive: boolean
  price: string | number | null
  isFree: boolean
  createdAt: Date | string
  updatedAt: Date | string
  isApproved: boolean
  approvedAt: Date | string | null
  approvalNote: string | null
  deletionRequested: boolean
  deletionRequestedAt: Date | string | null
  deletionRequestedReason: string | null
  deletionReviewedAt: Date | string | null
  deletionRejectedReason: string | null
  instructorId: string
  instructorName: string | null
  instructorEmail: string | null
  approvedByName: string | null
  categoryNameAr: string | null
  categoryNameEn: string | null
}

type Status =
  | "pending"
  | "approved"
  | "rejected"
  | "draft"

function getApprovalStatus(r: ReviewCourseRow): Status {
  if (r.isApproved) return "approved"
  if (r.approvalNote) return "rejected"
  if (!r.isPublished) return "draft"
  return "pending"
}

function fmtDate(v: Date | string | null | undefined) {
  if (!v) return "—"
  const d = typeof v === "string" ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function ApprovalTable({
  rows,
  isAr,
  lang,
}: {
  rows: ReviewCourseRow[]
  isAr: boolean
  lang: string
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [action, setAction] = useState<"approve" | "reject" | "revoke" | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [localRows, setLocalRows] = useState<ReviewCourseRow[]>(rows)

  const openRow = localRows.find((r) => r.id === openId)

  const pending = localRows.filter((r) => getApprovalStatus(r) === "pending")
  const approved = localRows.filter((r) => getApprovalStatus(r) === "approved")
  const rejected = localRows.filter((r) => getApprovalStatus(r) === "rejected")
  const drafts = localRows.filter((r) => getApprovalStatus(r) === "draft")

  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "draft">("pending")
  const list =
    tab === "pending" ? pending :
    tab === "approved" ? approved :
    tab === "rejected" ? rejected : drafts

  function openAction(id: string, a: "approve" | "reject" | "revoke") {
    setOpenId(id)
    setAction(a)
    setNote("")
  }

  async function submitAction() {
    if (!openId || !action) return
    setBusy(true)
    try {
      const res = await fetch(`/api/courses/${openId}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || null }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success(isAr ? "تم تحديث حالة الدورة" : "Course status updated")
      setLocalRows((prev) =>
        prev.map((r) => {
          if (r.id !== openId) return r
          const now = new Date().toISOString()
          const nextNote = note.trim() || (action === "approve" ? null : "Rejected by admin")
          return {
            ...r,
            isApproved: action === "approve",
            approvedAt: now,
            approvalNote: nextNote,
          }
        })
      )
      setOpenId(null)
      setAction(null)
    } catch (e) {
      toast.error(isAr ? "حدث خطأ" : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  const BadgeFor = (r: ReviewCourseRow) => {
    const s = getApprovalStatus(r)
    if (s === "approved") return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white"><Check className="h-3 w-3 mr-1" />{isAr ? "معتمدة" : "Approved"}</Badge>
    if (s === "rejected") return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />{isAr ? "مرفوضة" : "Rejected"}</Badge>
    if (s === "draft") return <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-300">{isAr ? "مسودة" : "Draft"}</Badge>
    return <Badge variant="default" className="bg-sky-500 hover:bg-sky-600 text-white"><Clock className="h-3 w-3 mr-1" />{isAr ? "قيد المراجعة" : "Pending"}</Badge>
  }

  const actionLabel =
    action === "approve" ? (isAr ? "اعتماد الدورة" : "Approve Course") :
    action === "reject" ? (isAr ? "رفض الدورة" : "Reject Course") :
    action === "revoke" ? (isAr ? "سحب الاعتماد" : "Revoke Approval") : ""

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["pending", isAr ? "قيد المراجعة" : "Pending", pending.length],
              ["approved", isAr ? "معتمدة" : "Approved", approved.length],
              ["rejected", isAr ? "مرفوضة" : "Rejected", rejected.length],
              ["draft", isAr ? "مسودات" : "Drafts", drafts.length],
            ] as const
          ).map(([key, label, count]) => (
            <Button
              key={key}
              type="button"
              variant={tab === key ? "default" : "outline"}
              className={tab === key ? "bg-sky-500 hover:bg-sky-600" : ""}
              onClick={() => setTab(key as any)}
            >
              {label}{" "}
              <span className={tab === key ? "ml-2 bg-white/20 rounded px-2 text-xs" : "ml-2 bg-muted rounded px-2 text-xs"}>
                {count}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">{isAr ? "الدورة" : "Course"}</TableHead>
              <TableHead>{isAr ? "المدرب" : "Instructor"}</TableHead>
              <TableHead>{isAr ? "التصنيف" : "Category"}</TableHead>
              <TableHead className="w-[120px]">{isAr ? "الحالة" : "Status"}</TableHead>
              <TableHead>{isAr ? "تاريخ الإنشاء" : "Created"}</TableHead>
              <TableHead className="text-right w-[300px]">{isAr ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {isAr ? "لا توجد دورات في هذا القسم." : "No courses in this section."}
                </TableCell>
              </TableRow>
            ) : (
              list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="relative h-14 w-20 shrink-0 rounded overflow-hidden bg-muted">
                        {r.thumbnailUrl ? (
                          <Image
                            src={r.thumbnailUrl}
                            alt={isAr ? r.titleAr : r.titleEn}
                            fill
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[280px]">
                          {isAr ? r.titleAr : r.titleEn}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                          {r.isFree ? (isAr ? "مجانية" : "Free") : `${r.price ?? 0} SAR`}
                          {" · "}
                          {r.isLive ? (isAr ? "مباشر" : "Live") : (isAr ? "مسجلة" : "Recorded")}
                          {r.isPublished ? "" : ` · ${isAr ? "غير منشور" : "Unpublished"}`}
                        </div>
                        {r.approvalNote && (
                          <div className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 max-w-[280px]">
                            <FileText className="inline h-3 w-3 mr-1 align-text-bottom" />
                            {r.approvalNote}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.instructorName ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.instructorEmail ?? "—"}</div>
                  </TableCell>
                  <TableCell>{isAr ? r.categoryNameAr : r.categoryNameEn || "—"}</TableCell>
                  <TableCell>{BadgeFor(r)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end flex-wrap">
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={`/${lang}/courses/${r.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {isAr ? "عرض" : "View"}
                        </a>
                      </Button>
                      {getApprovalStatus(r) !== "approved" ? (
                        <Button
                          size="sm"
                          className="bg-emerald-500 hover:bg-emerald-600 text-white"
                          onClick={() => openAction(r.id, "approve")}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          {isAr ? "اعتماد" : "Approve"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-700 border-amber-300 hover:bg-amber-50"
                          onClick={() => openAction(r.id, "revoke")}
                        >
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          {isAr ? "سحب" : "Revoke"}
                        </Button>
                      )}
                      {getApprovalStatus(r) !== "rejected" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openAction(r.id, "reject")}
                        >
                          <X className="h-4 w-4 mr-1" />
                          {isAr ? "رفض" : "Reject"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!openId && !!action} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionLabel}</DialogTitle>
            <DialogDescription>
              {openRow
                ? (isAr
                    ? `اسم الدورة: ${openRow.titleAr}`
                    : `Course: ${openRow.titleEn}`)
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <Label htmlFor="note">
              {isAr ? "ملاحظة إدارية (اختياري)" : "Admin note (optional)"}
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                action === "reject"
                  ? (isAr ? "سبب الرفض مثلاً..." : "Reason for rejection...")
                  : action === "revoke"
                  ? (isAr ? "سبب سحب الاعتماد..." : "Reason for revoking approval...")
                  : (isAr ? "أي ملاحظة إضافية للمدرب..." : "Any extra note for the instructor...")
              }
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenId(null)} disabled={busy}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              className={
                action === "approve"
                  ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-destructive hover:bg-destructive/90"
              }
              onClick={submitAction}
              disabled={busy}
            >
              {busy
                ? (isAr ? "جاري الحفظ..." : "Saving...")
                : actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
