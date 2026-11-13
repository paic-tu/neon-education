import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/rbac/require-permission"
import { hasAnyPermission } from "@/lib/rbac/permissions"
import { db } from "@/lib/db"
import { courses, orderItems, orders, products } from "@/lib/db/schema"
import { and, desc, eq, gt } from "drizzle-orm"
import { createStreamConsumer, createStreamPaymentLink, getAppBaseUrl, normalizeSaudiPhone } from "@/lib/payments/stream"

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  lang: z.enum(["ar", "en"]).default("ar"),
})

export async function POST(req: NextRequest) {
  const user = await requireAuth()
  const canTest = hasAnyPermission(user.role as any, ["orders:write", "store:write"])
  if (!canTest) {
    return NextResponse.json({ error: "Permission required: orders:write or store:write" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

    const { name, phone, lang } = parsed.data
    const phoneE164 = normalizeSaudiPhone(phone)

    const course = await db.query.courses.findFirst({
      where: and(eq(courses.isPublished, true), gt(courses.price, "0")),
      orderBy: [desc(courses.createdAt)],
      columns: { id: true, titleEn: true, titleAr: true, price: true, streamProductId: true },
    })

    const product = !course
      ? await db.query.products.findFirst({
          where: and(eq(products.isActive, true), gt(products.price, "0")),
          orderBy: [desc(products.createdAt)],
          columns: { id: true, nameEn: true, nameAr: true, price: true, streamProductId: true, productType: true },
        })
      : null

    if (product?.productType === "event_ticket") {
      return NextResponse.json({ error: "Use the store checkout for event tickets" }, { status: 400 })
    }

    const unitPrice = course ? course.price : product ? product.price : null
    if (!unitPrice) {
      return NextResponse.json({ error: "No paid published course or active product found to test" }, { status: 400 })
    }

    const total = Number.parseFloat(String(unitPrice))
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 })
    }

    const [order] = await db
      .insert(orders)
      .values({
        userId: user.id,
        status: "pending",
        totalAmount: total.toFixed(2),
        paymentProvider: "stream",
        gatewayStatus: "CREATED",
      })
      .returning({ id: orders.id })

    await db.insert(orderItems).values(
      course
        ? {
            orderId: order.id,
            courseId: course.id,
            productId: null,
            quantity: 1,
            price: total.toFixed(2),
          }
        : {
            orderId: order.id,
            courseId: null,
            productId: product!.id,
            quantity: 1,
            price: total.toFixed(2),
          },
    )

    const consumer = await createStreamConsumer({
      name,
      phone_number: phoneE164,
      external_id: `neon_test_${user.id}`,
    })

    const baseUrl = getAppBaseUrl()
    const successRedirectUrl = `${baseUrl}/${lang}/checkout/stream/success?order_id=${order.id}`
    const failureRedirectUrl = `${baseUrl}/${lang}/checkout/stream/failure?order_id=${order.id}`

    const titleEn = course ? course.titleEn : product!.nameEn
    const streamProductId = course ? course.streamProductId : product!.streamProductId
    if (!streamProductId) {
      return NextResponse.json({ error: "Missing stream product_id for selected item" }, { status: 400 })
    }
    const paymentLink = await createStreamPaymentLink({
      name: `${lang === "ar" ? "اختبار شراء" : "Test Purchase"} - ${titleEn}`,
      currency: "SAR",
      maxNumberOfPayments: 1,
      organizationConsumerId: consumer.id,
      successRedirectUrl,
      failureRedirectUrl,
      items: [{ productId: String(streamProductId), quantity: 1 }],
      customMetadata: {
        order_id: order.id,
        user_id: user.id,
        source: "stream_test_checkout",
        stream_consumer_id: consumer.id,
      },
    })

    await db
      .update(orders)
      .set({
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.url,
        gatewayStatus: paymentLink.status || "ACTIVE",
        branchId: process.env.STREAM_BRANCH_ID || null,
        gatewayPayload: paymentLink as any,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id))

    return NextResponse.json({
      success: true,
      orderId: order.id,
      item: course
        ? { type: "course", id: course.id, titleEn: course.titleEn, titleAr: course.titleAr, price: course.price }
        : { type: "product", id: product!.id, titleEn: product!.nameEn, titleAr: product!.nameAr, price: product!.price },
      consumerId: consumer.id,
      checkoutUrl: paymentLink.url,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 })
  }
}
