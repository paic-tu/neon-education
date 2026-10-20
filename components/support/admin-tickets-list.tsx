"use client"

import { useState, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight,
  Inbox,
  User,
  Calendar,
  Wrench,
  CreditCard,
  BookOpen,
  UserCog,
  MessageSquare,
  CircleDot,
  Timer,
  Clock,
  CheckCircle2,
  Archive,
  type LucideIcon,
} from "lucide-react"
import { AdminTicketActions } from "./admin-ticket-actions"

type TicketStatus = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed"
type TicketCategory = "technical" | "billing" | "course_content" | "account" | "other"

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
  userEmail?: string
  assigneeId?: string | null
  assigneeName?: string | null
  lastMessage?: string
}

interface AdminTicketsListProps {
  lang: "ar" | "en"
  initialTickets: AdminTicket[]
  assignees: Assignee[]
  canManage: boolean
  basePath: string
}

const statusMeta: Record<
  TicketStatus,
  { ar: string; en: string; badge: string; bar: string; glow: string; icon: LucideIcon }
> = {
  open: {
    ar: "مفتوحة",
    en: "Open",
    badge: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-300",
    bar: "bg-gradient-to-b from-blue-500 to-blue-400",
    glow: "hover:shadow-blue-500/10 hover:border-blue-500/30",
    icon: CircleDot,
  },
  in_progress: {
    ar: "قيد المعالجة",
    en: "In Progress",
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-300",
    bar: "bg-gradient-to-b from-amber-500 to-amber-400",
    glow: "hover:shadow-amber-500/10 hover:border-amber-500/30",
    icon: Timer,
  },
  waiting_customer: {
    ar: "بانتظار رد العميل",
    en: "Waiting Customer",
    badge: "bg-violet-500/10 text-violet-600 border-violet-500/30 dark:text-violet-300",
    bar: "bg-gradient-to-b from-violet-500 to-violet-400",
    glow: "hover:shadow-violet-500/10 hover:border-violet-500/30",
    icon: Clock,
  },
  resolved: {
    ar: "محلولة",
    en: "Resolved",
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-300",
    bar: "bg-gradient-to-b from-emerald-500 to-emerald-400",
    glow: "hover:shadow-emerald-500/10 hover:border-emerald-500/30",
    icon: CheckCircle2,
  },
  closed: {
    ar: "مغلقة",
    en: "Closed",
    badge: "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-300",
    bar: "bg-gradient-to-b from-slate-500 to-slate-400",
    glow: "hover:shadow-slate-500/10 hover:border-slate-500/30",
    icon: Archive,
  },
}

const categoryMeta: Record<TicketCategory, { ar: string; en: string; icon: LucideIcon; className: string }> = {
  technical: {
    ar: "فني",
    en: "Technical",
    icon: Wrench,
    className: "bg-sky-500/10 text-sky-600 border-sky-500/30 dark:text-sky-300",
  },
  billing: {
    ar: "فواتير",
    en: "Billing",
    icon: CreditCard,
    className: "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-300",
  },
  course_content: {
    ar: "دورات",
    en: "Courses",
    icon: BookOpen,
    className: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30 dark:text-indigo-300",
  },
  account: {
    ar: "حساب",
    en: "Account",
    icon: UserCog,
    className: "bg-teal-500/10 text-teal-600 border-teal-500/30 dark:text-teal-300",
  },
  other: {
    ar: "أخرى",
    en: "Other",
    icon: MessageSquare,
    className: "bg-muted text-muted-foreground border-border",
  },
}

export function AdminTicketsList({
  lang,
  initialTickets,
  assignees,
  canManage,
  basePath,
}: AdminTicketsListProps) {
  const [tickets] = useState<AdminTicket[]>(initialTickets || [])
  const isAr = lang === "ar"

  const filtered = useMemo(() => {
    return {
      all: tickets,
      open: tickets.filter((t) => t.status === "open"),
      in_progress: tickets.filter((t) => t.status === "in_progress"),
      waiting_customer: tickets.filter((t) => t.status === "waiting_customer"),
      resolved: tickets.filter((t) => t.status === "resolved"),
      closed: tickets.filter((t) => t.status === "closed"),
    }
  }, [tickets])

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

  const tabItems: { value: string; ar: string; en: string; count: number }[] = [
    { value: "all", ar: "الكل", en: "All", count: filtered.all.length },
    { value: "open", ar: "مفتوحة", en: "Open", count: filtered.open.length },
    { value: "in_progress", ar: "قيد المعالجة", en: "In Progress", count: filtered.in_progress.length },
    { value: "waiting_customer", ar: "بانتظار العميل", en: "Waiting", count: filtered.waiting_customer.length },
    { value: "resolved", ar: "محلولة", en: "Resolved", count: filtered.resolved.length },
    { value: "closed", ar: "مغلقة", en: "Closed", count: filtered.closed.length },
  ]

  const renderTicketList = (list: AdminTicket[]) => {
    if (list.length === 0) {
      return (
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border/70 bg-card/40 px-6 py-16 text-center">
          <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative mb-4 flex size-16 items-center justify-center rounded-2xl border border-border/60 bg-background/60 shadow-sm">
            <Inbox className="size-8 text-muted-foreground" />
            <span className="absolute -inset-1 -z-10 rounded-3xl bg-primary/20 blur-xl" />
          </div>
          <h3 className="relative text-lg font-semibold">
            {isAr ? "لا توجد تذاكر في هذه الفئة" : "No tickets in this category"}
          </h3>
          <p className="relative mt-1 text-sm text-muted-foreground">
            {isAr ? "ستظهر التذاكر الجديدة هنا تلقائياً" : "New tickets will appear here automatically"}
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {list.map((ticket) => {
          const meta = statusMeta[ticket.status] || statusMeta.open
          const cat = categoryMeta[ticket.category] || categoryMeta.other
          const StatusIcon = meta.icon
          const CatIcon = cat.icon

          return (
            <div
              key={ticket.id}
              className={`group relative overflow-hidden rounded-2xl border border-border/60 bg-card/50 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${meta.glow}`}
            >
              <span className={`absolute inset-y-0 start-0 w-1 ${meta.bar}`} />
              <div className="flex flex-col gap-4 p-4 ps-5 lg:flex-row lg:items-center lg:justify-between">
                <Link href={`${basePath}/${ticket.id}`} className="block min-w-0 flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg border ${meta.badge}`}>
                      <StatusIcon className="size-3.5" />
                    </span>
                    <h4 className="truncate font-semibold">{ticket.title}</h4>
                    <Badge variant="outline" className={`shrink-0 gap-1 ${meta.badge}`}>
                      {meta[isAr ? "ar" : "en"]}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {ticket.userName?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                      {ticket.userName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3.5" />
                      {formatDate(ticket.createdAt)}
                    </span>
                    <Badge variant="outline" className={`h-5 gap-1 text-xs ${cat.className}`}>
                      <CatIcon className="size-3" />
                      {cat[isAr ? "ar" : "en"]}
                    </Badge>
                    {ticket.assigneeName ? (
                      <Badge
                        variant="outline"
                        className="h-5 gap-1 border-primary/30 bg-primary/10 text-xs text-primary"
                      >
                        <User className="size-3" />
                        {isAr ? "المسؤول: " : "Assignee: "}
                        {ticket.assigneeName}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-5 text-xs text-muted-foreground">
                        {isAr ? "غير مُعيَّن" : "Unassigned"}
                      </Badge>
                    )}
                  </div>

                  {ticket.lastMessage && (
                    <p className="line-clamp-1 text-sm text-muted-foreground">{ticket.lastMessage}</p>
                  )}
                </Link>

                <div
                  className={`flex shrink-0 flex-col items-stretch gap-2 lg:flex-row lg:items-center ${
                    isAr ? "lg:mr-4" : "lg:ml-4"
                  }`}
                >
                  {canManage && (
                    <AdminTicketActions
                      ticketId={ticket.id}
                      lang={lang}
                      currentStatus={ticket.status as any}
                      currentAssigneeId={ticket.assigneeId || null}
                      assignees={assignees}
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className={`shrink-0 border border-transparent hover:border-primary/30 hover:bg-primary/10 hover:text-primary ${
                      isAr ? "flex-row-reverse" : ""
                    }`}
                  >
                    <Link href={`${basePath}/${ticket.id}`}>
                      {isAr ? "عرض" : "View"}
                      <ArrowRight className={`size-4 ${isAr ? "mr-2 rotate-180" : "ml-2"}`} />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="mb-6 grid h-auto grid-cols-2 gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1.5 sm:grid-cols-3 lg:grid-cols-6">
        {tabItems.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="gap-1.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-primary/30"
          >
            <span className="truncate">{isAr ? tab.ar : tab.en}</span>
            <Badge
              variant="secondary"
              className="h-5 min-w-[22px] justify-center bg-primary/10 text-xs tabular-nums text-primary"
            >
              {tab.count}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="all">{renderTicketList(filtered.all)}</TabsContent>
      <TabsContent value="open">{renderTicketList(filtered.open)}</TabsContent>
      <TabsContent value="in_progress">{renderTicketList(filtered.in_progress)}</TabsContent>
      <TabsContent value="waiting_customer">{renderTicketList(filtered.waiting_customer)}</TabsContent>
      <TabsContent value="resolved">{renderTicketList(filtered.resolved)}</TabsContent>
      <TabsContent value="closed">{renderTicketList(filtered.closed)}</TabsContent>
    </Tabs>
  )
}
