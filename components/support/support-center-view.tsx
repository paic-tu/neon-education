import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Inbox,
  ArrowRight,
  CircleDot,
  Timer,
  Clock,
  CheckCircle2,
  Archive,
  LifeBuoy,
  Calendar,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react"
import { NewTicketDialog } from "@/components/support/new-ticket-dialog"

export interface SupportTicketVM {
  id: string
  title: string
  category: string
  status: string
  createdAt: string
}

interface SupportCenterViewProps {
  lang: "ar" | "en"
  userName: string
  perspective: "student" | "instructor"
  basePath: string
  tickets: SupportTicketVM[]
}

const statusMeta: Record<
  string,
  { ar: string; en: string; badge: string; bar: string; orb: string; ring: string; icon: LucideIcon }
> = {
  open: {
    ar: "مفتوحة",
    en: "Open",
    badge: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-300",
    bar: "from-blue-500 to-blue-400",
    orb: "bg-blue-500/20",
    ring: "border-blue-500/30 bg-blue-500/10 text-blue-500 dark:text-blue-400",
    icon: CircleDot,
  },
  in_progress: {
    ar: "قيد المعالجة",
    en: "In Progress",
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-300",
    bar: "from-amber-500 to-amber-400",
    orb: "bg-amber-500/20",
    ring: "border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400",
    icon: Timer,
  },
  waiting_customer: {
    ar: "بانتظار ردّك",
    en: "Waiting for you",
    badge: "bg-violet-500/10 text-violet-600 border-violet-500/30 dark:text-violet-300",
    bar: "from-violet-500 to-violet-400",
    orb: "bg-violet-500/20",
    ring: "border-violet-500/30 bg-violet-500/10 text-violet-500 dark:text-violet-400",
    icon: Clock,
  },
  resolved: {
    ar: "محلولة",
    en: "Resolved",
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-300",
    bar: "from-emerald-500 to-emerald-400",
    orb: "bg-emerald-500/20",
    ring: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  closed: {
    ar: "مغلقة",
    en: "Closed",
    badge: "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-300",
    bar: "from-slate-500 to-slate-400",
    orb: "bg-slate-500/20",
    ring: "border-slate-500/30 bg-slate-500/10 text-slate-500 dark:text-slate-400",
    icon: Archive,
  },
}

const categoryLabels: Record<string, { ar: string; en: string }> = {
  technical: { ar: "فني", en: "Technical" },
  billing: { ar: "فواتير", en: "Billing" },
  course_content: { ar: "دورات", en: "Courses" },
  account: { ar: "حساب", en: "Account" },
  other: { ar: "أخرى", en: "Other" },
}

export function SupportCenterView({
  lang,
  userName,
  perspective,
  basePath,
  tickets,
}: SupportCenterViewProps) {
  const isAr = lang === "ar"

  const count = (status: string) => tickets.filter((t) => t.status === status).length
  const activeCount = count("open") + count("in_progress") + count("waiting_customer")
  const resolvedCount = count("resolved")

  const stats = [
    { key: "open", value: count("open"), meta: statusMeta.open },
    { key: "in_progress", value: count("in_progress"), meta: statusMeta.in_progress },
    { key: "resolved", value: resolvedCount, meta: statusMeta.resolved },
    { key: "closed", value: count("closed"), meta: statusMeta.closed },
  ]

  const greeting = isAr
    ? perspective === "instructor"
      ? `مرحباً ${userName}، نحن هنا لمساعدتك كمدرب`
      : `مرحباً ${userName}، نحن هنا لمساعدتك`
    : perspective === "instructor"
    ? `Hi ${userName}, we're here to help you as an instructor`
    : `Hi ${userName}, we're here to help`

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch {
      return dateStr
    }
  }

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
              <LifeBuoy className="size-7" />
              <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/25" />
              <span className="absolute -inset-1 -z-10 rounded-3xl bg-primary/30 blur-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {isAr ? "مركز الدعم الفني" : "Support Center"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{greeting}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 backdrop-blur">
              <Inbox className="size-4 text-primary" />
              <span className="text-sm font-semibold tabular-nums">{tickets.length}</span>
              <span className="text-xs text-muted-foreground">
                {isAr ? "إجمالي التذاكر" : "Total tickets"}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 backdrop-blur">
              <Timer className="size-4 text-primary" />
              <span className="text-sm font-semibold tabular-nums">{activeCount}</span>
              <span className="text-xs text-muted-foreground">{isAr ? "نشطة" : "Active"}</span>
            </div>
            <NewTicketDialog lang={lang} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.meta.icon
          const total = tickets.length
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
          return (
            <div
              key={s.key}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className={`pointer-events-none absolute -right-8 -top-8 size-24 rounded-full blur-2xl ${s.meta.orb}`} />
              <div className="relative flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {isAr ? s.meta.ar : s.meta.en}
                  </p>
                  <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{s.value}</p>
                </div>
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${s.meta.ring}`}>
                  <Icon className="size-4" />
                </span>
              </div>
              <div className="relative mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${s.meta.bar} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Tickets */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="flex flex-col gap-1 border-b border-border/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MessageSquareText className="size-5 text-primary" />
              {isAr ? "تذاكري" : "My Tickets"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAr
                ? "تابع حالة تذاكر الدعم التي أنشأتها وردود فريق الدعم"
                : "Track the status of your support tickets and replies from our team"}
            </p>
          </div>
          {tickets.length > 0 && (
            <Badge variant="secondary" className="w-fit tabular-nums">
              {tickets.length} {isAr ? "تذكرة" : "tickets"}
            </Badge>
          )}
        </div>

        <div className="p-4 sm:p-6">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-5 flex size-16 items-center justify-center rounded-2xl border border-border/60 bg-background/60">
                <Inbox className="size-7 text-muted-foreground" />
                <span className="absolute -inset-1 -z-10 rounded-3xl bg-primary/20 blur-xl" />
              </div>
              <h3 className="mb-1 text-lg font-semibold">
                {isAr ? "لا توجد تذاكر بعد" : "No tickets yet"}
              </h3>
              <p className="mb-5 max-w-sm text-sm text-muted-foreground">
                {isAr
                  ? "تواجه مشكلة؟ أنشئ تذكرة دعم جديدة وسيتواصل معك فريقنا في أقرب وقت."
                  : "Facing an issue? Create a new support ticket and our team will get back to you shortly."}
              </p>
              <NewTicketDialog lang={lang} />
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => {
                const meta = statusMeta[ticket.status] || statusMeta.open
                const StatusIcon = meta.icon
                const category = categoryLabels[ticket.category]?.[isAr ? "ar" : "en"] || ticket.category
                return (
                  <Link
                    key={ticket.id}
                    href={`${basePath}/${ticket.id}`}
                    className="group relative block overflow-hidden rounded-2xl border border-border/60 bg-background/40 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10"
                  >
                    <div className={`absolute inset-y-0 start-0 w-1 bg-gradient-to-b ${meta.bar}`} />
                    <div className={`pointer-events-none absolute -right-6 -top-8 size-20 rounded-full blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${meta.orb}`} />
                    <div className="relative flex flex-col gap-4 p-4 ps-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg border ${meta.badge}`}>
                            <StatusIcon className="size-3.5" />
                          </span>
                          <h3 className="truncate font-semibold">{ticket.title}</h3>
                          <Badge variant="outline" className={`h-5 shrink-0 px-2 py-0 text-xs ${meta.badge}`}>
                            {isAr ? meta.ar : meta.en}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="h-5 border-border/60 bg-muted/50 px-2 py-0 text-xs font-normal text-muted-foreground">
                            {category}
                          </Badge>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="size-3" />
                            {isAr ? "أُنشئت في" : "Created"} {formatDate(ticket.createdAt)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`shrink-0 text-primary group-hover:bg-primary/10 ${isAr ? "flex-row-reverse" : ""}`}
                      >
                        {isAr ? "عرض التفاصيل" : "View Details"}
                        <ArrowRight className={`size-4 ${isAr ? "mr-2 rotate-180" : "ml-2"} transition-transform group-hover:translate-x-0.5`} />
                      </Button>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
