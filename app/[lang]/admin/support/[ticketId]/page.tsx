import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { ArrowLeft, Ticket, Calendar, User, Mail } from "lucide-react"
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

const statusLabels: Record<string, { ar: string; en: string; className: string }> = {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" asChild className={isAr ? "flex-row-reverse" : ""}>
          <Link href={`/${lang}/admin/support`}>
            <ArrowLeft className={`h-4 w-4 ${isAr ? "ml-2 rotate-180" : "mr-2"}`} />
            {isAr ? "العودة لقائمة التذاكر" : "Back to Tickets"}
          </Link>
        </Button>
      </div>

      <Card className="border-indigo-200 dark:border-indigo-800">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Ticket className="h-5 w-5 text-indigo-500" />
                  <CardTitle className="text-xl">{title}</CardTitle>
                  <Badge
                    variant="outline"
                    className={`${statusLabels[ticket.status]?.className || ""}`}
                  >
                    {statusLabels[ticket.status]?.[isAr ? "ar" : "en"] || ticket.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {isAr ? "أنشئت في: " : "Created: "}
                    <span className="text-foreground">{formatDate(ticket.createdAt.toISOString())}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    {isAr ? "المستخدم: " : "User: "}
                    <span className="text-foreground inline-flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        {ticket.createdByAvatar ? (
                          <AvatarImage src={ticket.createdByAvatar} />
                        ) : (
                          <AvatarFallback className="text-[10px]">
                            {(ticket.createdByName || "U").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      {ticket.createdByName || "Unknown"}
                    </span>
                  </span>
                  {ticket.assignedToName && (
                    <span className="flex items-center gap-1.5">
                      <User className="h-4 w-4 text-indigo-600" />
                      {isAr ? "المخصص لـ: " : "Assigned to: "}
                      <span className="text-foreground font-medium">{ticket.assignedToName}</span>
                    </span>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="self-start shrink-0 text-sm px-3 py-1">
                {categoryLabels[ticket.category as TicketCategory]?.[isAr ? "ar" : "en"] || ticket.category}
              </Badge>
            </div>

            {canManage && (
              <AdminTicketDetailControls
                ticketId={ticket.id}
                lang={lang as "ar" | "en"}
                initialStatus={ticket.status}
                initialAssigneeId={ticket.assignedToId || null}
                assignees={assignees}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <TicketMessages
            ticketId={ticket.id}
            lang={lang as "ar" | "en"}
            initialMessages={messages}
            currentUserId={user.id}
            showInternalNote={canManage}
          />
        </CardContent>
      </Card>
    </div>
  )
}
