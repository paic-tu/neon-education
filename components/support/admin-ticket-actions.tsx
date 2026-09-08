"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { UserCheck, RefreshCw } from "lucide-react"
import { toast } from "sonner"

type TicketStatus = "open" | "in_progress" | "resolved" | "closed"

interface Assignee {
  id: string
  name: string
}

interface AdminTicketActionsProps {
  ticketId: string
  lang: "ar" | "en"
  currentStatus: TicketStatus
  currentAssigneeId?: string | null
  assignees: Assignee[]
}

const statusOptions: { value: TicketStatus; ar: string; en: string }[] = [
  { value: "open", ar: "مفتوحة", en: "Open" },
  { value: "in_progress", ar: "قيد المعالجة", en: "In Progress" },
  { value: "resolved", ar: "محلولة", en: "Resolved" },
  { value: "closed", ar: "مغلقة", en: "Closed" },
]

export function AdminTicketActions({
  ticketId,
  lang,
  currentStatus,
  currentAssigneeId,
  assignees,
}: AdminTicketActionsProps) {
  const [status, setStatus] = useState<TicketStatus>(currentStatus)
  const [assigneeId, setAssigneeId] = useState<string | null>(currentAssigneeId || null)
  const [saving, setSaving] = useState<"status" | "assignee" | null>(null)
  const isAr = lang === "ar"

  const handleStatusChange = async (newStatus: TicketStatus) => {
    setStatus(newStatus)
    setSaving("status")
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      toast.success(isAr ? "تم تحديث الحالة" : "Status updated")
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل التحديث" : "Update failed"))
      setStatus(currentStatus)
    } finally {
      setSaving(null)
    }
  }

  const handleAssigneeChange = async (newAssigneeId: string) => {
    setAssigneeId(newAssigneeId === "unassigned" ? null : newAssigneeId)
    setSaving("assignee")
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: newAssigneeId === "unassigned" ? null : newAssigneeId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      toast.success(isAr ? "تم تحديث المسؤول" : "Assignee updated")
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل التحديث" : "Update failed"))
      setAssigneeId(currentAssigneeId || null)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
      <div className="flex items-center gap-1.5">
        <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Select
          value={assigneeId || "unassigned"}
          onValueChange={handleAssigneeChange}
          disabled={saving === "assignee"}
        >
          <SelectTrigger size="sm" className="w-[140px] h-8">
            <SelectValue placeholder={isAr ? "اختر مسؤول" : "Assign"} />
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
        {saving === "assignee" && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex items-center gap-1.5">
        <Select
          value={status}
          onValueChange={(v) => handleStatusChange(v as TicketStatus)}
          disabled={saving === "status"}
        >
          <SelectTrigger size="sm" className="w-[130px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {isAr ? s.ar : s.en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {saving === "status" && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
    </div>
  )
}
