import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { orders } from "@/lib/db/schema"
import { BuyerEventTickets } from "@/components/buyer-event-tickets"
import { NavBar } from "@/components/nav-bar"
import { issueEventTickets } from "@/lib/events"
import { after } from "next/server"
import { notifyPaidOrder } from "@/lib/payments/payment-notifications"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function OrderTicketsPage({ params }: { params: Promise<{ lang: string; orderId: string }> }) {
  const { lang, orderId } = await params
  if (!z.string().uuid().safeParse(orderId).success) notFound()
  const user = await getCurrentUser()
  if (!user) redirect(`/${lang}/auth/login?callbackUrl=${encodeURIComponent(`/${lang}/tickets/${orderId}`)}`)
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.userId, user.id), eq(orders.status, "paid")),
    columns: { id: true },
  })
  if (!order) notFound()
  await issueEventTickets(order.id)
  after(async () => { await notifyPaidOrder(order.id) })
  return <div className="relative isolate z-10 min-h-svh bg-muted text-foreground"><NavBar /><main className="container mx-auto px-4 pb-12 pt-28">
    <h1 className="mb-3 text-2xl font-bold">{lang === "ar" ? "تذاكر طلبك في نيون" : "Your Neon Order Tickets"}</h1>
    <p className="mb-8 text-sm text-muted-foreground">{lang === "ar" ? "هذه الصفحة خاصة بحساب المشتري. اعرض الباركود لموظف الفعالية عند الدخول." : "This page is private to the buyer. Present your barcode to event staff at admission."}</p>
    <BuyerEventTickets key={order.id} lang={lang} orderId={order.id} />
  </main></div>
}
