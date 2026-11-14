import { redirect } from "next/navigation"
import { EventDesk } from "@/components/event-desk"
import { NavBar } from "@/components/nav-bar"
import { EventError, requireEventUser } from "@/lib/events"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function EventCheckInPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  try {
    await requireEventUser()
  } catch (e) {
    if (e instanceof EventError && e.status === 401) redirect(`/${lang}/auth/login?callbackUrl=/${lang}/events/check-in`)
    if (e instanceof EventError && e.status === 403) redirect(`/${lang}?error=unauthorized`)
    throw e
  }
  return <div className="relative isolate z-10 min-h-svh bg-background text-foreground"><NavBar /><main className="px-4 pb-10 pt-28 sm:px-6">
    <nav aria-label={lang === "ar" ? "بوابة الفعاليات" : "Event Portal"} className="mb-6 flex flex-wrap gap-3">
      <Link href={`/${lang}/events/check-in`} aria-current="page" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">{lang === "ar" ? "تسجيل الحضور" : "Check-in"}</Link>
      <Link href={`/${lang}/tickets`} className="rounded-lg border bg-card px-4 py-2 text-sm">{lang === "ar" ? "تذاكري" : "My Tickets"}</Link>
    </nav>
    <EventDesk lang={lang} />
  </main></div>
}
