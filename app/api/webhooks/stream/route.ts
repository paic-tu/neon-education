import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { cartItems, carts, enrollments, orderItems, orders, users } from "@/lib/db/schema"
import { and, eq, inArray, isNotNull } from "drizzle-orm"
import { streamRequest, verifyStreamWebhookSignature } from "@/lib/payments/stream"
import { sendMail } from "@/lib/mail"
import { getSiteSettings } from "@/lib/db/queries"
import { renderSubscriptionSuccessEmail, renderPaymentFailedEmail } from "@/lib/emails"

async function fulfillOrderCourses(userId: string, orderId: string) {
  const items = await db.query.orderItems.findMany({
    where: and(eq(orderItems.orderId, orderId), isNotNull(orderItems.courseId)),
    columns: { courseId: true },
  })

  const courseIds = items
    .map((it) => it.courseId)
    .filter(Boolean)
    .map((v) => String(v))

  if (courseIds.length > 0) {
    const existingEnrollments = await db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), inArray(enrollments.courseId, courseIds)))

    const existingSet = new Set(existingEnrollments.map((e) => String(e.courseId)))
    const toInsert = courseIds.filter((cid) => !existingSet.has(cid))
    if (toInsert.length > 0) {
      await db.insert(enrollments).values(
        toInsert.map((courseId) => ({
          userId,
          courseId,
          status: "active",
        })),
      )
    }
  }

  const userCarts = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId))
  const cartIds = userCarts.map((c) => c.id)
  if (cartIds.length > 0) {
    await db.delete(cartItems).where(inArray(cartItems.cartId, cartIds))
  }

  // Send enrollment email
  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (user?.email) {
      const settings = await getSiteSettings()
      const { html, text } = await renderSubscriptionSuccessEmail({
        language: "ar",
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/ar/portal/dashboard`,
      })
      await sendMail({
        to: user.email,
        subject: `تم الاشتراك بنجاح - ${settings.siteName}`,
        html,
        text,
      })
    }
  } catch (error) {
    console.error("Error sending enrollment email:", error)
  }
}

async function notifyPaymentFailed(userId: string) {
  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (user?.email) {
      const settings = await getSiteSettings()
      const { html, text } = await renderPaymentFailedEmail({
        language: "ar",
        userName: user.name || "",
        planName: "اشتراكك",
        billingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/ar/portal/billing`,
      })
      await sendMail({
        to: user.email,
        subject: `تعذر معالجة الدفع - ${settings.siteName}`,
        html,
        text,
      })
    }
  } catch (error) {
    console.error("Error sending payment failed email:", error)
  }
}

function normalizeStatus(raw: any) {
  const s = String(raw || "").trim().toUpperCase()
  return s
}

function isPaidStatus(statusRaw: string) {
  return statusRaw === "SUCCEEDED" || statusRaw === "SETTLED" || statusRaw === "PAID" || statusRaw === "COMPLETED"
}

export async function POST(req: Request) {
  const secret = process.env.STREAM_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: "STREAM_WEBHOOK_SECRET is not set" }, { status: 500 })
  }

  const signatureHeader = req.headers.get("x-webhook-signature")
  const rawBody = await req.text()

  const ok = verifyStreamWebhookSignature({
    secret,
    rawBody,
    signatureHeader,
  })

  if (!ok) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: any
  try {
    payload = rawBody ? JSON.parse(rawBody) : null
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const eventType = String(payload?.event_type || "")
  const allowed = new Set([
    "PAYMENT_SUCCEEDED",
    "PAYMENT_FAILED",
    "PAYMENT_CANCELED",
    "PAYMENT_REFUNDED",
    "PAYMENT_MARKED_AS_PAID",
    "INVOICE_CREATED",
    "INVOICE_SENT",
    "INVOICE_ACCEPTED",
    "INVOICE_REJECTED",
    "INVOICE_COMPLETED",
    "INVOICE_CANCELED",
    "INVOICE_UPDATED",
    "SUBSCRIPTION_CREATED",
    "SUBSCRIPTION_ACTIVATED",
    "SUBSCRIPTION_INACTIVATED",
    "SUBSCRIPTION_CANCELED",
    "SUBSCRIPTION_FROZEN",
    "SUBSCRIPTION_CYCLE_RENEWAL_FAILED",
    "SUBSCRIPTION_CANCEL_AT_PERIOD_END",
    "SUBSCRIPTION_FREEZE_NOW",
    "SUBSCRIPTION_UNFREEZE_NOW",
    "SUBSCRIPTION_UNFREEZE_FUTURE",
    "SUBSCRIPTION_FREEZE_CANCEL",
    "PAYMENT_LINK_PAY_ATTEMPT_FAILED",
  ])
  if (!allowed.has(eventType)) {
    return NextResponse.json({ success: true })
  }
  const data = payload?.data || {}
  let metadata = (data?.metadata || data?.custom_metadata || payload?.metadata || payload?.custom_metadata || {}) as any

  let orderIdFromMetadata =
    metadata?.order_id ? String(metadata.order_id) : metadata?.orderId ? String(metadata.orderId) : metadata?.order ? String(metadata.order) : null
  let paymentLinkId =
    data?.payment_link?.id ? String(data.payment_link.id) : payload?.payment_link_id ? String(payload.payment_link_id) : data?.payment_link_id ? String(data.payment_link_id) : null
  let invoiceId =
    data?.invoice?.id
      ? String(data.invoice.id)
      : payload?.invoice_id
        ? String(payload.invoice_id)
        : data?.invoice_id
          ? String(data.invoice_id)
          : payload?.entity_type === "INVOICE" && payload?.entity_id
            ? String(payload.entity_id)
            : null
  let paymentId =
    data?.payment?.id
      ? String(data.payment.id)
      : payload?.payment_id
        ? String(payload.payment_id)
        : data?.payment_id
          ? String(data.payment_id)
          : payload?.entity_type === "PAYMENT" && payload?.entity_id
            ? String(payload.entity_id)
            : null

  const statusRaw = normalizeStatus(payload?.status || data?.current_status || data?.status)
  const paidAtRaw = data?.payed_at || data?.paid_at || payload?.timestamp || null

  let order = null as any
  if (orderIdFromMetadata) {
    order = await db.query.orders.findFirst({ where: eq(orders.id, orderIdFromMetadata) })
  }

  if (!order && paymentLinkId) {
    order = await db.query.orders.findFirst({ where: eq(orders.paymentLinkId, paymentLinkId) })
  }

  if (!order && invoiceId) {
    order = await db.query.orders.findFirst({ where: eq(orders.invoiceId, invoiceId) })
  }

  if (!order && paymentId) {
    order = await db.query.orders.findFirst({ where: eq(orders.paymentId, paymentId) })
  }

  if (!order && (eventType === "PAYMENT_SUCCEEDED" || eventType === "PAYMENT_MARKED_AS_PAID" || eventType === "INVOICE_COMPLETED" || isPaidStatus(statusRaw))) {
    const entityType = String(payload?.entity_type || "").toUpperCase()
    const entityId = payload?.entity_id ? String(payload.entity_id) : null
    if (entityType && entityId) {
      let entity: any = null
      try {
        if (entityType === "PAYMENT") entity = await streamRequest<any>(`/payments/${entityId}`, { method: "GET" })
        else if (entityType === "INVOICE") entity = await streamRequest<any>(`/invoices/${entityId}`, { method: "GET" })
        else if (entityType === "PAYMENT_LINK") entity = await streamRequest<any>(`/payment_links/${entityId}`, { method: "GET" })
        else entity = null
      } catch {
        entity = null
      }

      const entityData = entity?.data ?? entity
      const entityMetadata = (entityData?.metadata || entityData?.custom_metadata || {}) as any
      metadata = { ...entityMetadata, ...metadata }
      orderIdFromMetadata =
        orderIdFromMetadata ||
        (metadata?.order_id ? String(metadata.order_id) : metadata?.orderId ? String(metadata.orderId) : metadata?.order ? String(metadata.order) : null)
      paymentLinkId =
        paymentLinkId ||
        (entityData?.payment_link_id
          ? String(entityData.payment_link_id)
          : entityData?.payment_link?.id
            ? String(entityData.payment_link.id)
            : null)
      invoiceId =
        invoiceId ||
        (entityData?.invoice_id ? String(entityData.invoice_id) : entityData?.invoice?.id ? String(entityData.invoice.id) : null)
      paymentId = paymentId || (entityData?.id ? String(entityData.id) : null)

      if (orderIdFromMetadata) order = await db.query.orders.findFirst({ where: eq(orders.id, orderIdFromMetadata) })
      if (!order && paymentLinkId) order = await db.query.orders.findFirst({ where: eq(orders.paymentLinkId, paymentLinkId) })
      if (!order && invoiceId) order = await db.query.orders.findFirst({ where: eq(orders.invoiceId, invoiceId) })
      if (!order && paymentId) order = await db.query.orders.findFirst({ where: eq(orders.paymentId, paymentId) })
    }
  }

  if (!order) {
    return NextResponse.json({ success: true })
  }

  const now = new Date()
  const paidAt = paidAtRaw ? new Date(String(paidAtRaw)) : now

  await db
    .update(orders)
    .set({
      invoiceId: invoiceId || order.invoiceId,
      paymentId: paymentId || order.paymentId,
      gatewayStatus: statusRaw || eventType || order.gatewayStatus,
      gatewayPayload: payload,
      lastWebhookAt: now,
      updatedAt: now,
    })
    .where(eq(orders.id, order.id))

  if (order.status !== "paid") {
    const shouldCancel =
      eventType === "PAYMENT_CANCELED" || eventType === "INVOICE_CANCELED" || eventType === "PAYMENT_LINK_PAY_ATTEMPT_FAILED"
    if (shouldCancel) {
      await db
        .update(orders)
        .set({
          status: "cancelled",
          updatedAt: now,
        })
        .where(eq(orders.id, order.id))
      await notifyPaymentFailed(order.userId)
      return NextResponse.json({ success: true })
    }
  }

  const shouldTryFulfill =
    eventType === "INVOICE_COMPLETED" ||
    eventType === "PAYMENT_SUCCEEDED" ||
    eventType === "PAYMENT_MARKED_AS_PAID" ||
    isPaidStatus(statusRaw)

  if (!shouldTryFulfill) {
    if (eventType === "PAYMENT_FAILED" || eventType === "SUBSCRIPTION_CYCLE_RENEWAL_FAILED") {
      await notifyPaymentFailed(order.userId)
    }
    return NextResponse.json({ success: true })
  }

  if (order.status === "paid") {
    return NextResponse.json({ success: true })
  }

  if (eventType === "PAYMENT_SUCCEEDED" || eventType === "PAYMENT_MARKED_AS_PAID" || isPaidStatus(statusRaw)) {
    await db
      .update(orders)
      .set({
        status: "paid",
        paidAt: order.paidAt ?? paidAt,
        paymentProvider: order.paymentProvider ?? "stream",
        updatedAt: now,
      })
      .where(eq(orders.id, order.id))
    await fulfillOrderCourses(order.userId, order.id)

    return NextResponse.json({ success: true })
  }

  if (!invoiceId) {
    return NextResponse.json({ success: true })
  }

  let invoice: any = null
  try {
    invoice = await streamRequest<any>(`/invoices/${invoiceId}`, { method: "GET" })
  } catch {
    invoice = null
  }

  const invoiceStatus = String(invoice?.status || invoice?.data?.status || "")
  const isInvoiceCompleted =
    invoiceStatus.toUpperCase() === "COMPLETED" || invoiceStatus.toUpperCase() === "PAID" || eventType === "INVOICE_COMPLETED"

  if (!isInvoiceCompleted) {
    return NextResponse.json({ success: true })
  }

  await db
    .update(orders)
    .set({
      status: "paid",
      paidAt: order.paidAt ?? paidAt,
      paymentProvider: order.paymentProvider ?? "stream",
      updatedAt: now,
    })
    .where(eq(orders.id, order.id))
  await fulfillOrderCourses(order.userId, order.id)

  return NextResponse.json({ success: true })
}
