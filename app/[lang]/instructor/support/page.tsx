import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SupportCenterView, type SupportTicketVM } from "@/components/support/support-center-view"
import { listSupportTickets } from "@/lib/db/support-queries"

export default async function InstructorSupportPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect(`/${lang}/auth/login`)
  }

  const isAr = lang === "ar"
  const role = (user as any).role || "instructor"

  let raw: any[] = []
  try {
    raw = await listSupportTickets(user.id, role)
  } catch (err) {
    console.error("[INSTRUCTOR_SUPPORT_LIST] Failed to list tickets:", err)
    raw = []
  }

  const tickets: SupportTicketVM[] = raw.map((t) => ({
    id: t.id,
    title: isAr ? t.subjectAr : t.subjectEn,
    category: t.category,
    status: t.status,
    createdAt: t.createdAt?.toISOString?.() || new Date().toISOString(),
  }))

  return (
    <SupportCenterView
      lang={lang as "ar" | "en"}
      userName={user.name || (isAr ? "عزيزي" : "there")}
      perspective="instructor"
      basePath={`/${lang}/instructor/support`}
      tickets={tickets}
    />
  )
}
