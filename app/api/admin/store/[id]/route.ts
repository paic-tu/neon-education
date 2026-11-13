import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { products } from "@/lib/db/schema"
import { requirePermission } from "@/lib/rbac/require-permission"
import { eq, and, isNull } from "drizzle-orm"
import { eventProductFields, validEventWindow } from "@/lib/event-product-validation"
import { requireEventUser, requireSameOrigin } from "@/lib/events"
import { getTicketSigningKey } from "@/lib/event-ticket-code"
import { discardNewStorePaymentProduct, StorePaymentError, syncStorePaymentProduct } from "@/lib/payments/store-product"

const updateSchema = z.object({
  ...eventProductFields,
  productType: eventProductFields.productType.optional(),
  nameEn: z.string().min(1).optional(),
  nameAr: z.string().min(1).optional(),
  descriptionEn: z.string().optional().nullable(),
  descriptionAr: z.string().optional().nullable(),
  price: z.number().finite().min(0).max(99999999.99).optional(),
  pointsCost: z.number().int().min(0).optional().nullable(),
  stock: z.number().int().min(0).optional(),
  categoryId: z.string().uuid().optional(),
  imageUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  await requirePermission("store:read")
  const { id } = await props.params
  const product = await db.query.products.findFirst({ where: eq(products.id, id) })
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(product)
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  await requirePermission("store:write")
  const { id } = await props.params
  let paymentProduct: { id: string; created: boolean } | undefined

  try {
    requireSameOrigin(req)
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 })

    const data = parsed.data
    const existing = await db.query.products.findFirst({ where: eq(products.id, id) })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (existing.productType === "event_ticket" || data.productType === "event_ticket") {
      await requireEventUser(true)
      getTicketSigningKey()
      if (data.productType && data.productType !== existing.productType) {
        return NextResponse.json({ error: "Event product type cannot be changed after creation" }, { status: 409 })
      }
      if (!validEventWindow({ ...existing, ...data })) {
        return NextResponse.json({ error: "Invalid event dates or location" }, { status: 400 })
      }
    }
    const updateData: any = { updatedAt: new Date() }

    if (data.nameEn !== undefined) updateData.nameEn = data.nameEn
    if (data.nameAr !== undefined) updateData.nameAr = data.nameAr
    if (data.descriptionEn !== undefined) updateData.descriptionEn = data.descriptionEn || null
    if (data.descriptionAr !== undefined) updateData.descriptionAr = data.descriptionAr || null
    if (data.price !== undefined) updateData.price = data.price.toFixed(2)
    if (data.pointsCost !== undefined) updateData.pointsCost = data.pointsCost ?? null
    if (data.stock !== undefined) updateData.stockQuantity = data.stock
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl || null
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.productType !== undefined) updateData.productType = data.productType
    if (data.eventStartsAt !== undefined) updateData.eventStartsAt = data.eventStartsAt ? new Date(data.eventStartsAt) : null
    if (data.eventEndsAt !== undefined) updateData.eventEndsAt = data.eventEndsAt ? new Date(data.eventEndsAt) : null
    if (data.eventLocation !== undefined) updateData.eventLocation = data.eventLocation

    paymentProduct = await syncStorePaymentProduct({
      name: data.nameEn ?? existing.nameEn,
      price: data.price !== undefined ? data.price.toFixed(2) : existing.price,
      existingId: existing.streamProductId,
      previousName: existing.nameEn,
      previousPrice: existing.price,
    })
    updateData.streamProductId = paymentProduct.id
    const condition = paymentProduct.created ? and(eq(products.id, id),
      existing.streamProductId ? eq(products.streamProductId, existing.streamProductId) : isNull(products.streamProductId))
      : eq(products.id, id)
    const [updated] = await db.update(products).set(updateData).where(condition).returning()
    if (!updated) {
      if (paymentProduct.created) await discardNewStorePaymentProduct(paymentProduct.id)
      return NextResponse.json({ error: "PRODUCT_CONCURRENT_UPDATE" }, { status: 409 })
    }
    return NextResponse.json({ success: true, product: updated })
  } catch (e) {
    if (paymentProduct?.created) {
      const persisted = await db.query.products.findFirst({ where: eq(products.id, id) })
        .then((row: any) => ({ paymentId: row?.streamProductId })).catch(() => null)
      if (persisted && persisted.paymentId !== paymentProduct.id) await discardNewStorePaymentProduct(paymentProduct.id)
    }
    if (e instanceof StorePaymentError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: "Failed to update product" }, { status: (e as any).status || 500 })
  }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  await requirePermission("store:write")
  const { id } = await props.params
  const product = await db.query.products.findFirst({ where: eq(products.id, id) })
  if (product?.productType === "event_ticket") {
    return NextResponse.json({ error: "Deactivate event products instead of deleting them" }, { status: 409 })
  }
  await db.delete(products).where(eq(products.id, id))
  return NextResponse.json({ success: true })
}
