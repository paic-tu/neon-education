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
import { Check, X, Trash2, FileText, AlertTriangle } from "lucide-react"
import Image from "next/image"

export type DeletionRequestRow = {
  id: string
  titleAr: string
  titleEn: string
  slug: string
  thumbnailUrl: string | null
  deletionRequested: boolean
  deletionRequestedAt: Date | string | null
  deletionRequestedReason: string | null
  deletionReviewedAt: Date | string | null
  deletionRejectedReason: string | null
  instructorId: string
  instructorName: string | null
  instructorEmail: string | null
  enrollmentCount?: number
  isApproved: boolean
  createdAt: Date | string | null
}

type Status = "pending" | "reviewed"

function getStatus(r: DeletionRequestRow): Status {
  return r.deletionReviewedAt ? "reviewed" : "pending"
}

function fmtDate(v: Date | string | null | undefined) {
  if (!v) return "—"
  const d = typeof v === "string" ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function DeletionRequestsTable({
  rows,
  isAr,
  lang,
}: {
  rows: DeletionRequestRow[]
  isAr: boolean
  lang: string
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [action, setAction] = useState<"approve" | "reject" | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [local, setLocal] = useState<DeletionRequestRow[]>(rows)

  const openRow = local.find((r) => r.id === openId)

  const pending = local.filter((r) => getStatus(r) === "pending" && r.deletionRequested)
  const reviewed = local.filter((r) => getStatus(r) === "reviewed" && r.deletionRequested)
  const [tab, setTab] = useState<"pending" | "reviewed">("pending")
  const list = tab === "pending" ? pending : reviewed

  function openAction(id: string, a: "approve" | "reject") {
    setOpenId(id)
    setAction(a)
    setReason("")
  }

  async function submitAction() {
    if (!openId || !action) return
    setBusy(true)
    try {
      const res = await fetch(`/api/courses/${openId}/deletion-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() || null }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success(isAr ? "تم تنفيذ الإجراء" : "Action completed")
      if (action === "approve") {
        // Course is now hard-deleted — remove from list
        setLocal((prev) => prev.filter((r) => r.id !== openId))
      } else {
        const now = new Date().toISOString()
        setLocal((prev) =>
          prev.map((r) =>
            r.id === openId
              ? {
                  ...r,
                  deletionRequested: false,
                  deletionReviewedAt: now,
                  deletionRejectedReason: reason.trim() || "Rejected by admin",
                }
              : r
          )
        )
      }
      setOpenId(null)
      setAction(null)
    } catch (e) {
      toast.error(isAr ? "حدث خطأ" : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  const actionLabel =
    action === "approve" ? (isAr ? "تأكيد الحذف النهائي للدورة" : "Permanently delete course") :
    action === "reject" ? (isAr ? "رفض طلب الحذف" : "Reject deletion request") : ""

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["pending", isAr ? "طلبات جديدة" : "Pending requests", pending.length],
              ["reviewed", isAr ? "تمت معالجتها" : "Reviewed", reviewed.length],
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
              <TableHead className="w-[180px]">{isAr ? "حالة الطلب" : "Status"}</TableHead>
              <TableHead>{isAr ? "سبب طلب الحذف" : "Deletion reason"}</TableHead>
              <TableHead>{isAr ? "تاريخ الطلب" : "Requested"}</TableHead>
              <TableHead className="text-right w-[260px]">{isAr ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {isAr ? "لا توجد طلبات حذف حالياً." : "No deletion requests currently."}
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
                        <div className="text-xs text-muted-foreground">
                          {isAr ? "معتمد" : "Approved"}: {r.isApproved ? "✅" : "—"}
                          {r.enrollmentCount !== undefined
                            ? ` · ${r.enrollmentCount} ${isAr ? "مسجل" : "enrolled"}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.instructorName ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.instructorEmail ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    {r.deletionReviewedAt ? (
                      r.deletionRejectedReason ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {isAr ? "مرفوض" : "Rejected"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Check className="h-3 w-3 mr-1" />
                          {isAr ? "محذوفة" : "Deleted"}
                        </Badge>
                      )
                    ) : (
                      <Badge variant="destructive">
                        <Trash2 className="h-3 w-3 mr-1" />
                        {isAr ? "بانتظار المراجعة" : "Pending"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[320px] text-sm">
                      {r.deletionRequestedReason ? (
                        <div className="bg-muted/60 rounded border border-muted-foreground/20 p-2 text-xs">
                          <FileText className="inline h-3 w-3 mr-1 align-text-bottom" />
                          {r.deletionRequestedReason}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {isAr ? "لا يوجد سبب مذكور" : "No reason provided"}
                        </span>
                      )}
                      {r.deletionRejectedReason ? (
                        <div className="mt-1 bg-amber-50 text-amber-700 border border-amber-200 rounded p-2 text-xs">
                          {isAr ? "سبب رفض الأدمن: " : "Admin rejection: "}
                          {r.deletionRejectedReason}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtDate(r.deletionRequestedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {!r.deletionReviewedAt && (
                      <div className="flex gap-2 justify-end flex-wrap">
                        <Button
                          size="sm"
                          className="bg-emerald-500 hover:bg-emerald-600 text-white"
                          onClick={() => openAction(r.id, "reject")}
                        >
                          <X className="h-4 w-4 mr-1" />
                          {isAr ? "رفض و استرجاع" : "Reject"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openAction(r.id, "approve")}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {isAr ? "موافقة والحذف" : "Approve & Delete"}
                        </Button>
                      </div>
                    )}
                    {r.deletionReviewedAt && (
                      <div className="text-xs text-muted-foreground">
                      {isAr ? "تمت المعالجة" : "Processed"} {fmtDate(r.deletionReviewedAt)}
                    </div>
                    )}
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
            <Label htmlFor="reason">
              {action === "approve"
                ? (isAr ? "ملاحظة نهائية (اختياري)" : "Final note (optional)")
                : (isAr ? "سبب رفض طلب الحذف (اختياري)" : "Reason for rejecting (optional)")}
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                action === "approve"
                  ? (isAr ? "ملاحظة نهائية (اختياري)..." : "Final note (optional)...")
                  : (isAr ? "سبب رفض طلب الحذف (اختياري)..." : "Reason for rejecting (optional)...")
              }
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenId(null)} disabled={busy}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              className={
                action === "approve"
                  ? "bg-destructive hover:bg-destructive/90"
                  : "bg-emerald-500 hover:bg-emerald-600"
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
