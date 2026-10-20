import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasPermission, canAccessAdmin } from "@/lib/rbac/permissions"
import { AdminTicketsList } from "@/components/support/admin-tickets-list"
import {
  Ticket,
  Shield,
  CircleDot,
  Timer,
  Clock,
  CheckCircle2,
  Archive,
  Users,
  Inbox,
} from "lucide-react"
import {
  listSupportTickets,
  listSupportAssignees,
  type SupportTicketCategory,
  type SupportTicketStatus,
} from "@/lib/db/support-queries"

type TicketStatus = SupportTicketStatus | (string & {})
type TicketCategory = SupportTicketCategory

interface Assignee {
  id: string
  name: string
}

interface AdminTicket {
  id: string
  title: string
  category: TicketCategory
  status: TicketStatus
  createdAt: string
  updatedAt: string
  userName: string
  assigneeName?: string | null
  lastMessage?: string
}

export default async function AdminSupportPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
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

  let rawTickets: any[] = []
  let rawAssignees: any[] = []
  const [ticketsResult, assigneesResult] = await Promise.allSettled([
    listSupportTickets(user.id, role),
    listSupportAssignees(),
  ])

  if (ticketsResult.status === "fulfilled") {
    rawTickets = ticketsResult.value
  } else {
    console.error("[ADMIN_SUPPORT_LIST] Failed to fetch tickets:", ticketsResult.reason)
  }

  if (assigneesResult.status === "fulfilled") {
    rawAssignees = assigneesResult.value
  } else {
    console.error("[ADMIN_SUPPORT_LIST] Failed to fetch assignees:", assigneesResult.reason)
  }

  const tickets: AdminTicket[] = rawTickets.map((t) => ({
    id: t.id,
    title: isAr ? t.subjectAr : t.subjectEn,
    category: t.category as any,
    status: t.status as any,
    createdAt: t.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: t.updatedAt?.toISOString?.() || new Date().toISOString(),
    userName: t.createdByName || "Unknown",
    assigneeName: t.assignedToName,
  }))

  const assignees: Assignee[] = rawAssignees.map((a) => ({
    id: a.id,
    name: a.name,
  }))

  const total = tickets.length
  const totalByStatus = {
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    waiting_customer: tickets.filter((t) => t.status === "waiting_customer").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  }

  const activeCount =
    totalByStatus.open + totalByStatus.in_progress + totalByStatus.waiting_customer
  const resolutionRate = total > 0 ? Math.round((totalByStatus.resolved / total) * 100) : 0

  const stats = [
    {
      key: "open",
      labelAr: "مفتوحة",
      labelEn: "Open",
      value: totalByStatus.open,
      icon: CircleDot,
      glow: "shadow-blue-500/20",
      ring: "border-blue-500/30 bg-blue-500/10 text-blue-500 dark:text-blue-400",
      beam: "via-blue-500/70",
      orb: "bg-blue-500/20",
      bar: "from-blue-500 to-blue-400",
    },
    {
      key: "in_progress",
      labelAr: "قيد المعالجة",
      labelEn: "In Progress",
      value: totalByStatus.in_progress,
      icon: Timer,
      glow: "shadow-amber-500/20",
      ring: "border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400",
      beam: "via-amber-500/70",
      orb: "bg-amber-500/20",
      bar: "from-amber-500 to-amber-400",
    },
    {
      key: "waiting_customer",
      labelAr: "بانتظار العميل",
      labelEn: "Waiting Customer",
      value: totalByStatus.waiting_customer,
      icon: Clock,
      glow: "shadow-violet-500/20",
      ring: "border-violet-500/30 bg-violet-500/10 text-violet-500 dark:text-violet-400",
      beam: "via-violet-500/70",
      orb: "bg-violet-500/20",
      bar: "from-violet-500 to-violet-400",
    },
    {
      key: "resolved",
      labelAr: "محلولة",
      labelEn: "Resolved",
      value: totalByStatus.resolved,
      icon: CheckCircle2,
      glow: "shadow-emerald-500/20",
      ring: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
      beam: "via-emerald-500/70",
      orb: "bg-emerald-500/20",
      bar: "from-emerald-500 to-emerald-400",
    },
    {
      key: "closed",
      labelAr: "مغلقة",
      labelEn: "Closed",
      value: totalByStatus.closed,
      icon: Archive,
      glow: "shadow-slate-500/20",
      ring: "border-slate-500/30 bg-slate-500/10 text-slate-500 dark:text-slate-400",
      beam: "via-slate-500/70",
      orb: "bg-slate-500/20",
      bar: "from-slate-500 to-slate-400",
    },
  ] as const

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30">
              <Ticket className="size-7" />
              <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/25" />
              <span className="absolute -inset-1 -z-10 rounded-3xl bg-primary/30 blur-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {isAr ? "مركز الدعم الفني" : "Support Center"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isAr
                  ? `مرحباً ${user.name}، إدارة ومتابعة تذاكر الدعم الفني للمنصة`
                  : `Hi ${user.name}, manage and track platform support tickets`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 backdrop-blur">
              <Inbox className="size-4 text-primary" />
              <span className="text-sm font-semibold tabular-nums">{total}</span>
              <span className="text-xs text-muted-foreground">{isAr ? "إجمالي التذاكر" : "Total tickets"}</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 backdrop-blur">
              <CheckCircle2 className="size-4 text-emerald-500 dark:text-emerald-400" />
              <span className="text-sm font-semibold tabular-nums">{resolutionRate}%</span>
              <span className="text-xs text-muted-foreground">{isAr ? "نسبة الحل" : "Resolution"}</span>
            </div>
            {canManage && (
              <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 backdrop-blur">
                <Shield className="size-4 text-primary" />
                <span className="text-xs font-medium text-primary">
                  {isAr ? "صلاحيات إدارية" : "Manager"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
          return (
            <div
              key={s.key}
              className={`group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${s.glow}`}
            >
              <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${s.beam}`} />
              <div className={`pointer-events-none absolute -right-8 -top-8 size-24 rounded-full blur-2xl ${s.orb}`} />
              <div className="relative flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {isAr ? s.labelAr : s.labelEn}
                  </p>
                  <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{s.value}</p>
                </div>
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${s.ring}`}>
                  <Icon className="size-4" />
                </span>
              </div>
              <div className="relative mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${s.bar} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="relative mt-1.5 text-[11px] tabular-nums text-muted-foreground">
                {pct}% {isAr ? "من الإجمالي" : "of total"}
              </p>
            </div>
          )
        })}
      </div>

      {/* Overview strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/40 px-4 py-3 backdrop-blur">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4 text-primary" />
          {isAr ? "التذاكر النشطة" : "Active tickets"}
        </span>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-primary">
          {activeCount}
        </span>
        <span className="text-xs text-muted-foreground">
          {isAr
            ? "(مفتوحة + قيد المعالجة + بانتظار العميل)"
            : "(open + in progress + waiting customer)"}
        </span>
      </div>

      {/* Tickets */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="flex flex-col gap-1 border-b border-border/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              {isAr ? "قائمة التذاكر" : "Tickets"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAr
                ? canManage
                  ? "عرض، تعيين، وتحديث حالة جميع التذاكر"
                  : "عرض جميع تذاكر الدعم الفني"
                : canManage
                ? "View, assign and update status of all tickets"
                : "View all support tickets"}
            </p>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <AdminTicketsList
            lang={lang as "ar" | "en"}
            initialTickets={tickets as any}
            assignees={assignees}
            canManage={canManage}
            basePath={`/${lang}/admin/support`}
          />
        </div>
      </div>
    </div>
  )
}
