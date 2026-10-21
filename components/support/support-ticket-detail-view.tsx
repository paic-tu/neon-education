import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  MessageSquare,
  Hash,
  type LucideIcon,
} from "lucide-react"
import { TicketMessages } from "@/components/support/ticket-messages"

export interface SupportTicketMessageVM {
  id: string
  ticketId: string
  userId: string
  userName: string
  userAvatar?: string | null
  userRole: string
  content: string
  createdAt: string
}

export interface SupportTicketDetailVM {
  id: string
  title: string
  status: string
  category: string
  createdAt: string
  createdByName: string
  createdByAvatar?: string | null
  assignedToName?: string | null
}

interface SupportTicketDetailViewProps {
  lang: "ar" | "en"
  basePath: string
  ticket: SupportTicketDetailVM
  messages: SupportTicketMessageVM[]
  currentUserId: string
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
    ar: "بانتظار ردّك",
    en: "Waiting for you",
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

const categoryLabels: Record<string, { ar: string; en: string }> = {
  technical: { ar: "فني", en: "Technical" },
  billing: { ar: "فواتير", en: "Billing" },
  course_content: { ar: "دورات", en: "Courses" },
  account: { ar: "حساب", en: "Account" },
  other: { ar: "أخرى", en: "Other" },
}

export function SupportTicketDetailView({
  lang,
  basePath,
  ticket,
  messages,
  currentUserId,
}: SupportTicketDetailViewProps) {
  const isAr = lang === "ar"
  const meta = statusMeta[ticket.status] || statusMeta.open
  const StatusIcon = meta.icon
  const category = categoryLabels[ticket.category]?.[isAr ? "ar" : "en"] || ticket.category

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
          <Link href={basePath}>
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

        <div className="relative p-6 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${meta.badge}`}>
                  <StatusIcon className="size-4" />
                </span>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{ticket.title}</h1>
                <Badge variant="outline" className={meta.badge}>
                  {isAr ? meta.ar : meta.en}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="h-6 gap-1.5 border-border/60 bg-background/60 text-xs font-normal">
                  <Hash className="size-3" />
                  {isAr ? "رقم التذكرة" : "Ticket ID"}:{" "}
                  <span className="tabular-nums">{ticket.id.slice(0, 8)}</span>
                </Badge>
                <Badge variant="outline" className="h-6 gap-1.5 border-border/60 bg-background/60 text-xs font-normal">
                  <Calendar className="size-3" />
                  {formatDate(ticket.createdAt)}
                </Badge>
                <Badge
                  variant="outline"
                  className="h-6 border-border/60 bg-background/60 text-xs font-normal"
                >
                  {category}
                </Badge>
              </div>
            </div>

            {/* Author card */}
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
                <p className="truncate text-sm font-semibold">{ticket.createdByName}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="size-3" />
                  {isAr ? "مقدّم التذكرة" : "Ticket author"}
                </p>
                {ticket.assignedToName && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-primary">
                    <span className="size-1.5 rounded-full bg-primary" />
                    {isAr ? "يتابعها: " : "Handled by: "}
                    <span className="font-medium">{ticket.assignedToName}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-border/60 bg-background/40 px-4 py-3 backdrop-blur">
            <Ticket className="size-4 text-primary" />
            <span className="text-xs text-muted-foreground">
              {isAr
                ? "يمكنك الرد مباشرة على التذكرة أدناه، وسيتم إشعار فريق الدعم بردّك."
                : "You can reply directly to the ticket below and our support team will be notified."}
            </span>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <MessageSquare className="size-4 text-primary" />
            {isAr ? "المحادثة" : "Conversation"}
          </h2>
          <Badge variant="secondary" className="tabular-nums">
            {messages.length} {isAr ? "رسالة" : "messages"}
          </Badge>
        </div>
        <div className="p-4 sm:p-6">
          <TicketMessages
            ticketId={ticket.id}
            lang={lang}
            initialMessages={messages}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </div>
  )
}
