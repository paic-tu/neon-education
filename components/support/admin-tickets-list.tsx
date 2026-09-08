"use client"

import { useState, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Inbox, User, Calendar } from "lucide-react"
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

const statusLabels: Record<TicketStatus, { ar: string; en: string; className: string }> = {
  open: {
    ar: "مفتوحة",
    en: "Open",
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  in_progress: {
    ar: "قيد المعالجة",
    en: "In Progress",
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  waiting_customer: {
    ar: "بانتظار رد العميل",
    en: "Waiting Customer",
    className: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
  },
  resolved: {
    ar: "محلولة",
    en: "Resolved",
    className: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800",
  },
  closed: {
    ar: "مغلقة",
    en: "Closed",
    className: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
}

const categoryLabels: Record<TicketCategory, { ar: string; en: string }> = {
  technical: { ar: "فني", en: "Technical" },
  billing: { ar: "فواتير", en: "Billing" },
  course_content: { ar: "دورات", en: "Courses" },
  account: { ar: "حساب", en: "Account" },
  other: { ar: "أخرى", en: "Other" },
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

  const renderTicketList = (list: AdminTicket[]) => {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-full bg-muted mb-4">
            <Inbox className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">
            {isAr ? "لا توجد تذاكر في هذه الفئة" : "No tickets in this category"}
          </h3>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {list.map((ticket) => (
          <div
            key={ticket.id}
            className="border rounded-lg p-4 hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <Link
                href={`${basePath}/${ticket.id}`}
                className="flex-1 min-w-0 space-y-2 block"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold truncate">{ticket.title}</h4>
                  <Badge
                    variant="outline"
                    className={`shrink-0 ${statusLabels[ticket.status].className}`}
                  >
                    {statusLabels[ticket.status][isAr ? "ar" : "en"]}
                  </Badge>
                </div>
                <div className="flex items-center gap-x-4 gap-y-2 flex-wrap text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {ticket.userName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(ticket.createdAt)}
                  </span>
                  <Badge variant="secondary" className="text-xs h-5">
                    {categoryLabels[ticket.category][isAr ? "ar" : "en"]}
                  </Badge>
                  {ticket.assigneeName && (
                    <Badge variant="outline" className="text-xs h-5 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
                      {isAr ? "المسؤول: " : "Assignee: "}{ticket.assigneeName}
                    </Badge>
                  )}
                </div>
                {ticket.lastMessage && (
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {ticket.lastMessage}
                  </p>
                )}
              </Link>

              <div className={`flex flex-col lg:flex-row items-stretch lg:items-center gap-2 shrink-0 ${isAr ? "lg:mr-4" : "lg:ml-4"}`}>
                {canManage && (
                  <AdminTicketActions
                    ticketId={ticket.id}
                    lang={lang}
                    currentStatus={ticket.status}
                    currentAssigneeId={ticket.assigneeId || null}
                    assignees={assignees}
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className={`hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300 shrink-0 ${isAr ? "flex-row-reverse" : ""}`}
                >
                  <Link href={`${basePath}/${ticket.id}`}>
                    {isAr ? "عرض" : "View"}
                    <ArrowRight className={`h-4 w-4 ${isAr ? "mr-2 rotate-180" : "ml-2"}`} />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Tabs defaultValue="open" className="w-full">
      <TabsList className="grid grid-cols-2 sm:grid-cols-5 mb-6">
        <TabsTrigger value="open">
          {isAr ? "مفتوحة" : "Open"}
          <Badge variant="secondary" className="ml-2 mr-2 text-xs h-5 min-w-[22px] justify-center">
            {filtered.open.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="in_progress">
          {isAr ? "قيد المعالجة" : "In Progress"}
          <Badge variant="secondary" className="ml-2 mr-2 text-xs h-5 min-w-[22px] justify-center">
            {filtered.in_progress.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="waiting_customer">
          {isAr ? "بانتظار العميل" : "Waiting"}
          <Badge variant="secondary" className="ml-2 mr-2 text-xs h-5 min-w-[22px] justify-center">
            {filtered.waiting_customer.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="resolved">
          {isAr ? "محلولة" : "Resolved"}
          <Badge variant="secondary" className="ml-2 mr-2 text-xs h-5 min-w-[22px] justify-center">
            {filtered.resolved.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="closed">
          {isAr ? "مغلقة" : "Closed"}
          <Badge variant="secondary" className="ml-2 mr-2 text-xs h-5 min-w-[22px] justify-center">
            {filtered.closed.length}
          </Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="open">{renderTicketList(filtered.open)}</TabsContent>
      <TabsContent value="in_progress">{renderTicketList(filtered.in_progress)}</TabsContent>
      <TabsContent value="waiting_customer">{renderTicketList(filtered.waiting_customer)}</TabsContent>
      <TabsContent value="resolved">{renderTicketList(filtered.resolved)}</TabsContent>
      <TabsContent value="closed">{renderTicketList(filtered.closed)}</TabsContent>
    </Tabs>
  )
}
