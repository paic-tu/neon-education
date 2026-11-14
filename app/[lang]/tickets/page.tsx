import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ShieldCheck, Ticket } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import { canAccessAdmin } from "@/lib/rbac/permissions"
import { BuyerEventTickets } from "@/components/buyer-event-tickets"
import { StudentPortalChrome } from "@/components/student/student-portal-chrome"
import { InstructorPortalChrome } from "@/components/instructor/instructor-portal-chrome"
import { AdminSidebar, AdminMobileNav } from "@/components/admin/admin-sidebar"
import { AdminHeader } from "@/components/admin/admin-header"
import { NavBar } from "@/components/nav-bar"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function MyTicketsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/${lang}/auth/login?callbackUrl=${encodeURIComponent(`/${lang}/tickets`)}`)
  const isAr = lang === "ar"

  const content = (
    <div dir={isAr ? "rtl" : "ltr"} className="mx-auto w-full max-w-7xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="max-w-2xl">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-primary"><Ticket className="h-4 w-4" />{isAr ? "نيون / تذاكر الفعاليات" : "NEON / EVENT TICKETS"}</p>
          <h1 className="mb-3 text-3xl font-bold">{isAr ? "تذاكري" : "My Tickets"}</h1>
          <p className="text-sm leading-7 text-muted-foreground">{isAr ? "تذاكر فعالياتك في مكان واحد. استعرض تفاصيل الحجز وباركود الدخول وحالة الحضور." : "Your event tickets in one place. View booking details, admission barcodes, and attendance status."}</p>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />{isAr ? "تظهر هنا التذاكر الخاصة بحسابك فقط." : "Only tickets belonging to your account appear here."}</p>
        </div>
        <Link href={`/${lang}/events`} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">{isAr ? "استكشف الفعاليات" : "Explore Events"}</Link>
      </div>
      <BuyerEventTickets lang={lang} />
    </div>
  )

  // Personal tickets use the user's existing portal, not event-management permissions.
  if (canAccessAdmin(user.role)) {
    const adminUser = { ...user, avatarUrl: user.image }
    return (
      <div className="relative z-10 flex min-h-screen bg-muted">
        <AdminSidebar user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader user={adminUser} mobileNav={<AdminMobileNav user={user} />} />
          <main className="flex-1 p-6">{content}</main>
        </div>
      </div>
    )
  }
  const portalUser = { name: user.name || "", email: user.email || "", role: user.role, image: user.image }
  if (user.role === "instructor") return <InstructorPortalChrome user={portalUser}>{content}</InstructorPortalChrome>
  if (user.role === "student") return <StudentPortalChrome user={portalUser}>{content}</StudentPortalChrome>

  return (
    <div className="relative isolate z-10 min-h-svh bg-muted text-foreground">
      <NavBar />
      <main className="container mx-auto px-4 pb-12 pt-28">
        <nav aria-label={isAr ? "بوابة الفعاليات" : "Event Portal"} className="mb-6 flex flex-wrap gap-3">
          <Link href={`/${lang}/events/check-in`} className="rounded-lg border bg-card px-4 py-2 text-sm">{isAr ? "تسجيل الحضور" : "Check-in"}</Link>
          <Link href={`/${lang}/tickets`} aria-current="page" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">{isAr ? "تذاكري" : "My Tickets"}</Link>
        </nav>
        {content}
      </main>
    </div>
  )
}
