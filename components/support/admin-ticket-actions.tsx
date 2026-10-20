"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserCheck, RefreshCw, CircleDot, Timer, Clock, CheckCircle2, Archive, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

type TicketStatus = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed"

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

const statusOptions: { value: TicketStatus; ar: string; en: string; icon: LucideIcon; className: string }[] = [
  {
    value: "open",
    ar: "مفتوحة",
    en: "Open",
    icon: CircleDot,
    className: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  },
  {
    value: "in_progress",
    ar: "قيد المعالجة",
    en: "In Progress",
    icon: Timer,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  {
    value: "waiting_customer",
    ar: "بانتظار العميل",
    en: "Waiting Customer",
    icon: Clock,
    className: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  {
    value: "resolved",
    ar: "محلولة",
    en: "Resolved",
    icon: CheckCircle2,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  {
    value: "closed",
    ar: "مغلقة",
    en: "Closed",
    icon: Archive,
    className: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
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

  const currentOpt = statusOptions.find((s) => s.value === status) || statusOptions[0]
  const CurrentIcon = currentOpt.icon

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
      <div className="flex items-center gap-1.5">
        <UserCheck className="size-3.5 shrink-0 text-muted-foreground" />
        <Select
          value={assigneeId || "unassigned"}
          onValueChange={handleAssigneeChange}
          disabled={saving === "assignee"}
        >
          <SelectTrigger size="sm" className="h-8 w-[140px] border-border/60 bg-background/60 backdrop-blur">
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
        {saving === "assignee" && <RefreshCw className="size-3 animate-spin text-primary" />}
      </div>

      <div className="flex items-center gap-1.5">
        <Select
          value={status}
          onValueChange={(v) => handleStatusChange(v as TicketStatus)}
          disabled={saving === "status"}
        >
          <SelectTrigger size="sm" className="h-8 w-[130px] border-border/60 bg-background/60 backdrop-blur">
            <span className="flex items-center gap-1.5">
              <span className={`flex size-4 items-center justify-center rounded border ${currentOpt.className}`}>
                <CurrentIcon className="size-2.5" />
              </span>
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => {
              const Icon = s.icon
              return (
                <SelectItem key={s.value} value={s.value}>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${s.className}`}>
                    <Icon className="size-3" />
                    {isAr ? s.ar : s.en}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        {saving === "status" && <RefreshCw className="size-3 animate-spin text-primary" />}
      </div>
    </div>
  )
}
