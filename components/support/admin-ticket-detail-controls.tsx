"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

type TicketStatus = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed"

interface Assignee {
  id: string
  name: string
}

interface AdminTicketDetailControlsProps {
  ticketId: string
  lang: "ar" | "en"
  initialStatus: TicketStatus
  initialAssigneeId?: string | null
  assignees: Assignee[]
  onStatusChange?: (status: TicketStatus) => void
  onAssigneeChange?: (assigneeId: string | null) => void
}

const statusOptions: { value: TicketStatus; ar: string; en: string }[] = [
  { value: "open", ar: "مفتوحة", en: "Open" },
  { value: "in_progress", ar: "قيد المعالجة", en: "In Progress" },
  { value: "waiting_customer", ar: "بانتظار رد العميل", en: "Waiting Customer" },
  { value: "resolved", ar: "محلولة", en: "Resolved" },
  { value: "closed", ar: "مغلقة", en: "Closed" },
]

const statusClassNames: Record<TicketStatus, string> = {
  open: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  in_progress: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  waiting_customer: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
  resolved: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800",
  closed: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
}

export function AdminTicketDetailControls({
  ticketId,
  lang,
  initialStatus,
  initialAssigneeId,
  assignees,
  onStatusChange,
  onAssigneeChange,
}: AdminTicketDetailControlsProps) {
  const [status, setStatus] = useState<TicketStatus>(initialStatus)
  const [assigneeId, setAssigneeId] = useState<string | null>(initialAssigneeId || null)
  const [saving, setSaving] = useState<"status" | "assignee" | null>(null)
  const isAr = lang === "ar"

  const handleStatusChange = async (newStatus: TicketStatus) => {
    setSaving("status")
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setStatus(newStatus)
      onStatusChange?.(newStatus)
      toast.success(isAr ? "تم تحديث حالة التذكرة" : "Ticket status updated")
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل التحديث" : "Update failed"))
    } finally {
      setSaving(null)
    }
  }

  const handleAssigneeChange = async (newAssigneeId: string) => {
    const finalId = newAssigneeId === "unassigned" ? null : newAssigneeId
    setSaving("assignee")
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: finalId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setAssigneeId(finalId)
      onAssigneeChange?.(finalId)
      toast.success(isAr ? "تم تحديث مسؤول التذكرة" : "Ticket assignee updated")
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل التحديث" : "Update failed"))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg border bg-muted/40">
      <div className="space-y-2">
        <Label htmlFor="status-select" className="flex items-center gap-2">
          {isAr ? "حالة التذكرة" : "Ticket Status"}
          {saving === "status" && <RefreshCw className="h-3 w-3 animate-spin" />}
        </Label>
        <Select value={status} onValueChange={(v) => handleStatusChange(v as TicketStatus)}>
          <SelectTrigger id="status-select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <span className={`px-2 py-0.5 rounded-full text-xs border ${statusClassNames[s.value]}`}>
                  {isAr ? s.ar : s.en}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assignee-select" className="flex items-center gap-2">
          {isAr ? "المسؤول عن التذكرة" : "Assigned To"}
          {saving === "assignee" && <RefreshCw className="h-3 w-3 animate-spin" />}
        </Label>
        <Select
          value={assigneeId || "unassigned"}
          onValueChange={handleAssigneeChange}
        >
          <SelectTrigger id="assignee-select" className="w-full">
            <SelectValue placeholder={isAr ? "اختر مسؤولاً" : "Select assignee"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">{isAr ? "غير محدد" : "Unassigned"}</SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
