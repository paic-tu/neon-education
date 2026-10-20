"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { RefreshCw, CircleDot, Timer, Clock, CheckCircle2, Archive, UserCheck, ListChecks, type LucideIcon } from "lucide-react"
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

const statusOptions: { value: TicketStatus; ar: string; en: string; icon: LucideIcon }[] = [
  { value: "open", ar: "مفتوحة", en: "Open", icon: CircleDot },
  { value: "in_progress", ar: "قيد المعالجة", en: "In Progress", icon: Timer },
  { value: "waiting_customer", ar: "بانتظار رد العميل", en: "Waiting Customer", icon: Clock },
  { value: "resolved", ar: "محلولة", en: "Resolved", icon: CheckCircle2 },
  { value: "closed", ar: "مغلقة", en: "Closed", icon: Archive },
]

const statusClassNames: Record<TicketStatus, string> = {
  open: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  in_progress: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  waiting_customer: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  resolved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  closed: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
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

  const currentOpt = statusOptions.find((s) => s.value === status)
  const CurrentIcon = currentOpt?.icon || CircleDot

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="status-select" className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ListChecks className="size-3.5 text-primary" />
          {isAr ? "حالة التذكرة" : "Ticket Status"}
          {saving === "status" && <RefreshCw className="size-3 animate-spin text-primary" />}
        </Label>
        <Select value={status} onValueChange={(v) => handleStatusChange(v as TicketStatus)}>
          <SelectTrigger id="status-select" className="w-full border-border/60 bg-background/60 backdrop-blur">
            <span className="flex items-center gap-2">
              <span className={`flex size-5 items-center justify-center rounded-md border ${statusClassNames[status]}`}>
                <CurrentIcon className="size-3" />
              </span>
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => {
              const Icon = s.icon
              return (
                <SelectItem key={s.value} value={s.value}>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${statusClassNames[s.value]}`}>
                    <Icon className="size-3" />
                    {isAr ? s.ar : s.en}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assignee-select" className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <UserCheck className="size-3.5 text-primary" />
          {isAr ? "المسؤول عن التذكرة" : "Assigned To"}
          {saving === "assignee" && <RefreshCw className="size-3 animate-spin text-primary" />}
        </Label>
        <Select
          value={assigneeId || "unassigned"}
          onValueChange={handleAssigneeChange}
        >
          <SelectTrigger id="assignee-select" className="w-full border-border/60 bg-background/60 backdrop-blur">
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
