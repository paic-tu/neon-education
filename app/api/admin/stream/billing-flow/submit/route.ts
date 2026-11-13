import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission } from "@/lib/rbac/require-permission"
import { db } from "@/lib/db"
import { orderItems, orders, products, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { createStreamConsumer, getAppBaseUrl, normalizeSaudiPhone, streamRequest } from "@/lib/payments/stream"
import { requireEventUser, requireSameOrigin } from "@/lib/events"

const schema = z.object({
  userId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
  currency: z.string().default("SAR"),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  mode: z.enum(["invoice", "payment_link"]),
  customMetadata: z.record(z.any()).optional().nullable(),
  paymentMethods: z
    .object({
      mada: z.boolean().optional(),
      visa: z.boolean().optional(),
      mastercard: z.boolean().optional(),
      amex: z.boolean().optional(),
      bank_transfer: z.boolean().optional(),
      installment: z.boolean().optional(),
    })
    .optional()
    .nullable(),
})

export async function POST(req: NextRequest) {
  const admin = await requirePermission("store:write")

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
  const input = parsed.data

  const u = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
    columns: { id: true, name: true, email: true, phoneNumber: true, phone: true, streamConsumerId: true, preferences: true },
  })
  if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const p = await db.query.products.findFirst({
    where: eq(products.id, input.productId),
    columns: { id: true, nameEn: true, nameAr: true, price: true, streamProductId: true, productType: true },
  })
  if (!p) return NextResponse.json({ error: "Product not found" }, { status: 404 })
  if (p.productType === "event_ticket") {
    requireSameOrigin(req)
    await requireEventUser(true)
    if (!(process.env.STREAM_API_KEY_BASE64 || (process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET))) {
      return NextResponse.json({ error: "Configure Stream Pay API credentials first" }, { status: 503 })
    }
  }

  let streamConsumerId = u.streamConsumerId
  if (!streamConsumerId) {
    const phoneRaw = u.phoneNumber || u.phone || ""
    const consumer = await createStreamConsumer({
      name: u.name,
      phone_number: phoneRaw ? normalizeSaudiPhone(phoneRaw) : undefined,
      email: u.email || undefined,
      external_id: `neon_user_${u.id}`,
      communication_methods: ["WHATSAPP"],
      preferred_language: typeof u.preferences?.preferred_language === "string" ? u.preferences.preferred_language : undefined,
      alias: u.name,
      comment: "Created via Admin Billing Flow",
      iban: typeof u.preferences?.iban === "string" ? u.preferences.iban : undefined,
    })
    streamConsumerId = consumer.id
    await db.update(users).set({ streamConsumerId, updatedAt: new Date() }).where(eq(users.id, u.id))
  }

  let streamProductId = p.streamProductId
  if (!streamProductId) {
    const createdStream = await streamRequest<any>("/products", {
      method: "POST",
      body: JSON.stringify({ name: p.nameEn || p.nameAr, type: "ONE_OFF", currency: "SAR", price: String(p.price) }),
    })
    streamProductId = createdStream?.id
    if (!streamProductId) return NextResponse.json({ error: "Stream product id missing" }, { status: 500 })
    await db.update(products).set({ streamProductId, updatedAt: new Date() }).where(eq(products.id, p.id))
  }

  const unitPrice = Number.parseFloat(String(p.price))
  const total = Number((unitPrice * input.quantity).toFixed(2))
  if (!Number.isFinite(total) || total <= 0) return NextResponse.json({ error: "Invalid total amount" }, { status: 400 })

  const [order] = await db
    .insert(orders)
    .values({
      userId: u.id,
      status: "pending",
      totalAmount: total.toFixed(2),
      paymentProvider: "stream",
      gatewayStatus: "CREATED",
      notes: input.description || null,
    })
    .returning()

  await db.insert(orderItems).values({
    orderId: order.id,
    productId: p.id,
    courseId: null,
    quantity: input.quantity,
    price: unitPrice.toFixed(2),
  })

  const baseUrl = getAppBaseUrl()
  const successRedirectUrl = `${baseUrl}/en/checkout/stream/success?order_id=${order.id}`
  const failureRedirectUrl = `${baseUrl}/en/checkout/stream/failure?order_id=${order.id}`

  const metadata = {
    ...(input.customMetadata || {}),
    user_id: u.id,
    product_id: p.id,
    order_id: order.id,
    admin_id: admin.id,
    stream_consumer_id: streamConsumerId,
    stream_product_id: streamProductId,
  }

  try {
    if (input.mode === "invoice") {
      const scheduledOn =
        input.dueDate && input.dueDate.trim()
          ? new Date(`${input.dueDate.trim()}T00:00:00.000Z`).toISOString()
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const paymentMethods = input.paymentMethods || {
        mada: true,
        visa: true,
        mastercard: true,
        amex: true,
        bank_transfer: true,
        installment: true,
      }

      const payload: any = {
        notify_consumer: true,
        description: input.description ?? undefined,
        currency: input.currency,
        items: [{ product_id: streamProductId, quantity: input.quantity }],
        payment_methods: paymentMethods,
        organization_consumer_id: streamConsumerId,
        scheduled_on: scheduledOn,
        metadata,
      }

      const created = await streamRequest<any>("/invoices", { method: "POST", body: JSON.stringify(payload) })
      await db
        .update(orders)
        .set({
          invoiceId: String(created?.id || ""),
          gatewayStatus: String(created?.status || "INVOICE_CREATED"),
          gatewayPayload: created,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id))

      return NextResponse.json({ success: true, mode: "invoice", orderId: order.id, streamInvoice: created })
    }

    const created = await streamRequest<any>("/payment_links", {
      method: "POST",
      body: JSON.stringify({
        name: `Order ${order.id}`,
        currency: input.currency,
        items: [{ product_id: streamProductId, quantity: input.quantity }],
        max_number_of_payments: 1,
        organization_consumer_id: streamConsumerId,
        success_redirect_url: successRedirectUrl,
        failure_redirect_url: failureRedirectUrl,
        custom_metadata: metadata,
        contact_information_type: "PHONE",
      }),
    })

    await db
      .update(orders)
      .set({
        paymentLinkId: String(created?.id || ""),
        paymentLinkUrl: String(created?.url || ""),
        gatewayStatus: String(created?.status || "PAYMENT_LINK_CREATED"),
        gatewayPayload: created,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id))

    return NextResponse.json({ success: true, mode: "payment_link", orderId: order.id, paymentLink: created })
  } catch (e) {
    await db.update(orders).set({ gatewayStatus: "FAILED", updatedAt: new Date() }).where(eq(orders.id, order.id))
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 })
  }
}
