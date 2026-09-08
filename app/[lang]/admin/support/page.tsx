import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Ticket, Shield } from "lucide-react"
import { hasPermission, canAccessAdmin } from "@/lib/rbac/permissions"
import { AdminTicketsList } from "@/components/support/admin-tickets-list"
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
  try {
    ;[rawTickets, rawAssignees] = await Promise.all([
      listSupportTickets(user.id, role),
      listSupportAssignees(),
    ])
  } catch (err) {
    console.error("[ADMIN_SUPPORT_LIST] Failed to fetch data:", err)
    rawTickets = []
    rawAssignees = []
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

  const totalByStatus = {
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    waiting_customer: tickets.filter((t) => t.status === "waiting_customer").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Ticket className="h-7 w-7 text-indigo-500" />
            {isAr ? "إدارة تذاكر الدعم الفني" : "Support Tickets Management"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAr
              ? `مرحباً ${user.name}، إدارة جميع تذاكر الدعم الفني للمنصة`
              : `Hi ${user.name}, manage all platform support tickets`}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
            <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              {isAr ? "صلاحيات إدارية" : "Manage Permissions"}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">
              {isAr ? "مفتوحة" : "Open"}
            </div>
            <div className="text-2xl font-bold">{totalByStatus.open}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">
              {isAr ? "قيد المعالجة" : "In Progress"}
            </div>
            <div className="text-2xl font-bold">{totalByStatus.in_progress}</div>
          </CardContent>
        </Card>
        <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-900/10">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">
              {isAr ? "بانتظار رد العميل" : "Waiting Customer"}
            </div>
            <div className="text-2xl font-bold">{totalByStatus.waiting_customer}</div>
          </CardContent>
        </Card>
        <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">
              {isAr ? "محلولة" : "Resolved"}
            </div>
            <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{totalByStatus.resolved}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">
              {isAr ? "مغلقة" : "Closed"}
            </div>
            <div className="text-2xl font-bold">{totalByStatus.closed}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "جميع التذاكر" : "All Tickets"}</CardTitle>
          <CardDescription>
            {isAr
              ? canManage
                ? "يمكنك عرض وتعيين وتغيير حالة جميع التذاكر"
                : "عرض جميع تذاكر الدعم الفني"
              : canManage
              ? "View, assign and update status of all tickets"
              : "View all support tickets"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminTicketsList
            lang={lang as "ar" | "en"}
            initialTickets={tickets as any}
            assignees={assignees}
            canManage={canManage}
            basePath={`/${lang}/admin/support`}
          />
        </CardContent>
      </Card>
    </div>
  )
}
