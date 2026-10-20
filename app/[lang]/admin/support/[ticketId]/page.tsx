import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import {
  ArrowLeft,
  Ticket,
  Calendar,
  User,
  Clock,
  CircleDot,
  Timer,
  CheckCircle2,
  Archive,
  type LucideIcon,
} from "lucide-react"
import { hasPermission, canAccessAdmin } from "@/lib/rbac/permissions"
import { TicketMessages } from "@/components/support/ticket-messages"
import { AdminTicketDetailControls } from "@/components/support/admin-ticket-detail-controls"
import {
  getSupportTicketById,
  listTicketMessages,
  listSupportAssignees,
  type SupportTicketCategory,
  type SupportTicketStatus,
} from "@/lib/db/support-queries"

type TicketStatus = SupportTicketStatus | (string & {})
type TicketCategory = SupportTicketCategory

interface Message {
  id: string
  ticketId: string
  userId: string
  userName: string
  userAvatar?: string | null
  userRole: string
  content: string
  isInternal?: boolean
  createdAt: string
}

interface Assignee {
  id: string
  name: string
}

const statusMeta: Record<
  string,
  { ar: string; en: string; badge: string; bar: string; icon: LucideIcon }
> = {
  open: {
    ar: "مفتوحة",
    en: "Open",
    badge: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-300",
    bar: "from-blue-500 to-blue-400",
    icon: CircleDot,
  },
  in_progress: {
    ar: "قيد المعالجة",
    en: "In Progress",
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-300",
    bar: "from-amber-500 to-amber-400",
    icon: Timer,
  },
  waiting_customer: {
    ar: "بانتظار رد العميل",
    en: "Waiting Customer",
    badge: "bg-violet-500/10 text-violet-600 border-violet-500/30 dark:text-violet-300",
    bar: "from-violet-500 to-violet-400",
    icon: Clock,
  },
  resolved: {
    ar: "محلولة",
    en: "Resolved",
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-300",
    bar: "from-emerald-500 to-emerald-400",
    icon: CheckCircle2,
  },
  closed: {
    ar: "مغلقة",
    en: "Closed",
    badge: "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-300",
    bar: "from-slate-500 to-slate-400",
    icon: Archive,
  },
}

const categoryLabels: Record<TicketCategory, { ar: string; en: string }> = {
  technical: { ar: "فني", en: "Technical" },
  billing: { ar: "فواتير", en: "Billing" },
  course_content: { ar: "دورات", en: "Courses" },
  account: { ar: "حساب", en: "Account" },
  other: { ar: "أخرى", en: "Other" },
}

export default async function AdminSupportDetailPage({
  params,
}: {
  params: Promise<{ lang: string; ticketId: string }>
}) {
  const { lang, ticketId } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect(`/${lang}/auth/login`)
  }

  const role = (user as any).role

  if (!canAccessAdmin(role)) {
    redirect(`/${lang}/access-denied`)
  }

  if (!hasPermission(role, "support:read")) {
    redirect(`/${lang}/access-denied`)
  }

  const canManage = hasPermission(role, "support:manage")
  const isAr = lang === "ar"

  let ticket: any = null
  let rawMessages: any[] = []
  let rawAssignees: any[] = []
  try {
    ;[ticket, rawMessages, rawAssignees] = await Promise.all([
      getSupportTicketById(user.id, role, ticketId),
      listTicketMessages(user.id, role, ticketId),
      listSupportAssignees(),
    ])
  } catch (err) {
    console.error("[ADMIN_SUPPORT_DETAIL] Failed to fetch data:", err)
    ticket = null
    rawMessages = []
    rawAssignees = []
  }

  if (!ticket) {
    redirect(`/${lang}/admin/support`)
  }

  const title = isAr ? ticket.subjectAr : ticket.subjectEn
  const messages: Message[] = rawMessages.map((m) => ({
    id: m.id,
    ticketId: m.ticketId,
    userId: m.senderId,
    userName: m.senderName || "Unknown",
    userAvatar: m.senderAvatar,
    userRole: m.senderRole || "student",
    content: m.content,
    isInternal: m.isInternal,
    createdAt: m.createdAt.toISOString(),
  }))

  const assignees: Assignee[] = rawAssignees.map((a) => ({
    id: a.id,
    name: a.name,
  }))

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(isAr ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  const meta = statusMeta[ticket.status] || statusMeta.open
  const StatusIcon = meta.icon

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          asChild
          className={`border border-border/60 bg-card/50 backdrop-blur hover:border-primary/30 hover:bg-primary/10 hover:text-primary ${
            isAr ? "flex-row-reverse" : ""
          }`}
        >
          <Link href={`/${lang}/admin/support`}>
            <ArrowLeft className={`size-4 ${isAr ? "ml-2 rotate-180" : "mr-2"}`} />
            {isAr ? "العودة لقائمة التذاكر" : "Back to Tickets"}
          </Link>
        </Button>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${meta.bar}`} />
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative space-y-5 p-6 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${meta.badge}`}>
                  <StatusIcon className="size-4" />
                </span>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
                <Badge variant="outline" className={meta.badge}>
                  {meta[isAr ? "ar" : "en"]}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="h-6 gap-1.5 border-border/60 bg-background/60 text-xs font-normal">
                  <Ticket className="size-3" />
                  {isAr ? "رقم التذكرة" : "Ticket ID"}: <span className="tabular-nums">{ticket.id.slice(0, 8)}</span>
                </Badge>
                <Badge variant="outline" className="h-6 gap-1.5 border-border/60 bg-background/60 text-xs font-normal">
                  <Calendar className="size-3" />
                  {formatDate(ticket.createdAt.toISOString())}
                </Badge>
                <Badge variant="outline" className="h-6 gap-1.5 border-primary/30 bg-primary/10 text-xs font-normal text-primary">
                  <User className="size-3" />
                  {ticket.createdByName || (isAr ? "غير معروف" : "Unknown")}
                </Badge>
                <Badge variant="outline" className="h-6 border-border/60 bg-background/60 text-xs font-normal">
                  {categoryLabels[ticket.category as TicketCategory]?.[isAr ? "ar" : "en"] || ticket.category}
                </Badge>
              </div>
            </div>

            {/* User card */}
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border/60 bg-background/50 px-4 py-3 backdrop-blur">
              <Avatar className="size-11 ring-2 ring-primary/20">
                {ticket.createdByAvatar ? (
                  <AvatarImage src={ticket.createdByAvatar} />
                ) : (
                  <AvatarFallback className="bg-gradient-to-br from-primary/80 to-accent/80 text-primary-foreground">
                    {(ticket.createdByName || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {ticket.createdByName || (isAr ? "غير معروف" : "Unknown")}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="size-3" />
                  {isAr ? "مقدّم التذكرة" : "Ticket author"}
                </p>
                {ticket.assignedToName && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-primary">
                    <span className="size-1.5 rounded-full bg-primary" />
                    {isAr ? "المخصص لـ: " : "Assigned: "}
                    <span className="font-medium">{ticket.assignedToName}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {canManage && (
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/40 backdrop-blur">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="p-4">
                <AdminTicketDetailControls
                  ticketId={ticket.id}
                  lang={lang as "ar" | "en"}
                  initialStatus={ticket.status}
                  initialAssigneeId={ticket.assignedToId || null}
                  assignees={assignees}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {isAr ? "المحادثة" : "Conversation"}
          </h2>
          <Badge variant="secondary" className="tabular-nums">
            {messages.length} {isAr ? "رسالة" : "messages"}
          </Badge>
        </div>
        <div className="p-4 sm:p-6">
          <TicketMessages
            ticketId={ticket.id}
            lang={lang as "ar" | "en"}
            initialMessages={messages}
            currentUserId={user.id}
            showInternalNote={canManage}
          />
        </div>
      </div>
    </div>
  )
}
