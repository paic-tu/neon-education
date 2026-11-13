import Link from "next/link"
import { redirect } from "next/navigation"
import { and, eq, isNotNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { cartItems, carts, enrollments, orderItems, orders } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/auth"
import { NavBar } from "@/components/nav-bar"
import { SiteFooter } from "@/components/site-footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { verifyOrderViaStream } from "@/lib/payments/verify-order"
import { issueEventTickets } from "@/lib/events"
import { BuyerEventTickets } from "@/components/buyer-event-tickets"
import { z } from "zod"

export default async function StreamCheckoutSuccessPage(props: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ order_id?: string }>
}) {
  const { lang } = await props.params
  const sp = await props.searchParams
  const orderId = z.string().uuid().safeParse(sp.order_id).success ? sp.order_id : undefined

  const user = await getCurrentUser()
  if (!user) redirect(`/${lang}/auth/login?redirectTo=/${lang}/checkout/stream/success`)

  if (!orderId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <main className="container mx-auto px-4 py-12 flex-1">
          <Card>
            <CardHeader>
              <CardTitle>{lang === "ar" ? "تم الدفع" : "Payment Completed"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-muted-foreground">{lang === "ar" ? "تم استلام نتيجة الدفع." : "We received the payment result."}</div>
              <Button asChild>
                <Link href={`/${lang}/store`}>{lang === "ar" ? "العودة للمتجر" : "Back to Store"}</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <SiteFooter />
      </div>
    )
  }

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.userId, user.id)),
    columns: { id: true, status: true, totalAmount: true, paymentLinkId: true, invoiceId: true, paymentId: true },
  })

  let resolvedStatus = order?.status || "pending"
  const hasEventItems = order ? await db.query.orderItems.findFirst({
    where: and(eq(orderItems.orderId, order.id), eq(orderItems.isEventTicket, true)),
    columns: { id: true },
  }) : null

  if (order && order.status === "pending") {
    let proof: Awaited<ReturnType<typeof verifyOrderViaStream>> = null
    try {
      proof = await verifyOrderViaStream(order)
    } catch {
      proof = null
    }

    if (proof?.state === "paid") {
      const updated = await db
        .update(orders)
        .set({
          status: "paid",
          paidAt: new Date(),
          paymentId: proof.paymentId,
          invoiceId: proof.invoiceId,
          gatewayStatus: "PAID",
          gatewayPayload: proof,
          updatedAt: new Date(),
        })
        .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
        .returning({ id: orders.id })

      if (updated.length) {
        const items = await db.query.orderItems.findMany({
          where: and(eq(orderItems.orderId, order.id), isNotNull(orderItems.courseId)),
          columns: { courseId: true },
        })

        for (const it of items) {
          if (!it.courseId) continue
          const existing = await db.query.enrollments.findFirst({
            where: and(eq(enrollments.userId, user.id), eq(enrollments.courseId, it.courseId)),
            columns: { id: true },
          })
          if (!existing) {
            await db.insert(enrollments).values({
              userId: user.id,
              courseId: it.courseId,
              status: "active",
            })
          }
        }

        const cart = await db.query.carts.findFirst({
          where: eq(carts.userId, user.id),
          columns: { id: true },
        })
        if (cart?.id) {
          await db.delete(cartItems).where(eq(cartItems.cartId, cart.id))
        }

        resolvedStatus = "paid"
      }
    } else {
      resolvedStatus = order.status
    }
  }

  if (order && resolvedStatus === "paid" && hasEventItems) await issueEventTickets(order.id)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />
      <main className="container mx-auto px-4 pb-12 pt-28 flex-1">
        <Card>
          <CardHeader>
            <CardTitle>
              {resolvedStatus === "paid"
                ? lang === "ar"
                  ? "تم الدفع بنجاح"
                  : "Payment Successful"
                : lang === "ar"
                  ? "بانتظار تأكيد الدفع"
                  : "Waiting for payment confirmation"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4" dir={lang === "ar" ? "rtl" : "ltr"}>
            <div className="text-muted-foreground">
              {resolvedStatus === "paid"
                ? lang === "ar"
                  ? "تم استلام عملية الدفع. تم تفعيل مشترياتك."
                  : "Payment received. Your purchases are now activated."
                : lang === "ar"
                  ? "تم استلام نتيجة الدفع، لكن لم تصلنا إشارة التأكيد بعد. أعد تحميل الصفحة بعد لحظات."
                  : "We received the redirect, but confirmation hasn't arrived yet. Refresh in a moment."}
            </div>
            {order && (
              <div className="text-sm text-muted-foreground">
                {lang === "ar" ? "حالة الطلب" : "Order status"}: {resolvedStatus}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/${lang}/student/my-courses`}>{lang === "ar" ? "دوراتي" : "My Courses"}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/${lang}/orders`}>{lang === "ar" ? "طلباتي وتذاكري" : "My Orders & Tickets"}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        {resolvedStatus === "paid" && hasEventItems && <div className="mt-6"><BuyerEventTickets lang={lang} /></div>}
      </main>
      <SiteFooter />
    </div>
  )
}
