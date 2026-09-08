import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Ticket, ArrowRight, Inbox } from "lucide-react"
import { NewTicketDialog } from "@/components/support/new-ticket-dialog"
import { listSupportTickets, type SupportTicketCategory, type SupportTicketStatus } from "@/lib/db/support-queries"

type TicketStatus = Exclude<SupportTicketStatus, "waiting_customer"> | (string & {})
type TicketCategory = SupportTicketCategory

interface SupportTicket {
  id: string
  title: string
  category: TicketCategory
  status: TicketStatus
  createdAt: string
  updatedAt: string
  lastMessage?: string
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

export default async function StudentSupportPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect(`/${lang}/auth/login`)
  }

  const isAr = lang === "ar"
  const role = (user as any).role || "student"

  let raw: any[] = []
  try {
    raw = await listSupportTickets(user.id, role)
  } catch (err) {
    console.error("[STUDENT_SUPPORT_LIST] Failed to list tickets:", err)
    raw = []
  }

  const tickets: SupportTicket[] = raw.map((t) => ({
    id: t.id,
    title: isAr ? t.subjectAr : t.subjectEn,
    category: t.category as any,
    status: (t.status as any) in statusLabels ? t.status : "open",
    createdAt: t.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: t.updatedAt?.toISOString?.() || new Date().toISOString(),
  }))

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
    <div className="container py-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Ticket className="h-7 w-7 text-indigo-500" />
            {isAr ? "مركز الدعم الفني" : "Support Center"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAr ? `مرحباً ${user.name}، نحن هنا لمساعدتك` : `Hi ${user.name}, we're here to help`}
          </p>
        </div>
        <NewTicketDialog lang={lang as "ar" | "en"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "تذاكري" : "My Tickets"}</CardTitle>
          <CardDescription>
            {isAr
              ? "عرض جميع تذاكر الدعم التي قمت بإنشائها"
              : "View all support tickets you have created"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Inbox className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">
                {isAr ? "لا توجد تذاكر بعد" : "No tickets yet"}
              </h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-sm">
                {isAr
                  ? "تواجه مشكلة؟ أنشئ تذكرة دعم جديدة وسنتواصل معك في أقرب وقت."
                  : "Facing an issue? Create a new support ticket and we'll get back to you shortly."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/${lang}/student/support/${ticket.id}`}
                  className="block group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold truncate">{ticket.title}</h4>
                        <Badge
                          variant="outline"
                          className={`shrink-0 ${statusLabels[ticket.status]?.className || ""}`}
                        >
                          {statusLabels[ticket.status]?.[isAr ? "ar" : "en"] || ticket.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {categoryLabels[ticket.category]?.[isAr ? "ar" : "en"] || ticket.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {isAr ? "أنشئت في: " : "Created: "}
                          {formatDate(ticket.createdAt)}
                        </span>
                      </div>
                      {ticket.lastMessage && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {ticket.lastMessage}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`group-hover:bg-indigo-100 group-hover:text-indigo-700 dark:group-hover:bg-indigo-900/30 dark:group-hover:text-indigo-300 shrink-0 ${isAr ? "flex-row-reverse" : ""}`}
                    >
                      {isAr ? "عرض التفاصيل" : "View Details"}
                      <ArrowRight className={`h-4 w-4 ${isAr ? "mr-2 rotate-180" : "ml-2"} group-hover:translate-x-0.5 transition-transform`} />
                    </Button>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
