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
import Link from "next/link"
import { ArrowUpRight, ShieldCheck } from "lucide-react"

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
    <div className="mb-8 flex flex-wrap items-start justify-between gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="max-w-2xl">
        <p className="mb-3 text-xs font-semibold tracking-widest text-primary">{lang === "ar" ? "نيون / تذاكر الفعاليات" : "NEON / EVENT TICKETS"}</p>
        <h1 className="mb-3 text-3xl font-bold sm:text-4xl">{lang === "ar" ? "تذكرتك. تجربة نيون." : "Your Ticket. The Neon Experience."}</h1>
        <p className="text-sm leading-7 text-muted-foreground">{lang === "ar" ? "كل ما تحتاجه للدخول في مكان واحد. اعرض الباركود عند الوصول، أو احتفظ بتذكرتك في محفظة Apple عند توفرها." : "Everything you need for admission, in one place. Present your barcode on arrival or save your ticket in Apple Wallet when available."}</p>
        <span className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />{lang === "ar" ? "صفحة خاصة بحساب المشتري" : "Private to the ticket owner"}</span>
      </div>
      <Link href={`/${lang}/orders`} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">{lang === "ar" ? "عرض طلباتي" : "My Orders"}<ArrowUpRight className="h-4 w-4" /></Link>
    </div>
    <BuyerEventTickets key={order.id} lang={lang} orderId={order.id} />
  </main></div>
}
