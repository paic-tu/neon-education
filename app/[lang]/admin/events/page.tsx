import { requireEventUser } from "@/lib/events"
import { EventDesk } from "@/components/event-desk"
import type { Metadata } from "next"

export const metadata: Metadata = { robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function AdminEventsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  await requireEventUser(true)
  return <EventDesk lang={lang} />
}
