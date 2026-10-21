import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import {
  SupportTicketDetailView,
  type SupportTicketMessageVM,
} from "@/components/support/support-ticket-detail-view"
import { getSupportTicketById, listTicketMessages } from "@/lib/db/support-queries"

export default async function StudentSupportDetailPage({
  params,
}: {
  params: Promise<{ lang: string; ticketId: string }>
}) {
  const { lang, ticketId } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect(`/${lang}/auth/login`)
  }

  const isAr = lang === "ar"
  const role = (user as any).role || "student"

  let ticket: any = null
  let rawMessages: any[] = []
  try {
    ticket = await getSupportTicketById(user.id, role, ticketId)
  } catch (err) {
    console.error("[STUDENT_SUPPORT_DETAIL] Failed to get ticket:", err)
    ticket = null
  }

  if (!ticket) {
    redirect(`/${lang}/student/support`)
  }

  try {
    rawMessages = await listTicketMessages(user.id, role, ticketId)
  } catch (err) {
    console.error("[STUDENT_SUPPORT_DETAIL] Failed to list messages:", err)
    rawMessages = []
  }

  const messages: SupportTicketMessageVM[] = rawMessages.map((m) => ({
    id: m.id,
    ticketId: m.ticketId,
    userId: m.senderId,
    userName: m.senderName || "Unknown",
    userAvatar: m.senderAvatar,
    userRole: m.senderRole || "student",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }))

  return (
    <SupportTicketDetailView
      lang={lang as "ar" | "en"}
      basePath={`/${lang}/student/support`}
      currentUserId={user.id}
      messages={messages}
      ticket={{
        id: ticket.id,
        title: isAr ? ticket.subjectAr : ticket.subjectEn,
        status: ticket.status,
        category: ticket.category,
        createdAt: ticket.createdAt.toISOString(),
        createdByName: ticket.createdByName || (isAr ? "غير معروف" : "Unknown"),
        createdByAvatar: ticket.createdByAvatar,
        assignedToName: ticket.assignedToName,
      }}
    />
  )
}
