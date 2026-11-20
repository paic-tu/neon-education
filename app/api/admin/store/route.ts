import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { products } from "@/lib/db/schema"
import { requirePermission } from "@/lib/rbac/require-permission"
import { desc, eq } from "drizzle-orm"
import { eventProductFields, validEventWindow } from "@/lib/event-product-validation"
import { requireEventUser, requireSameOrigin } from "@/lib/events"
import { getTicketSigningKey } from "@/lib/event-ticket-code"
import { randomUUID } from "node:crypto"
import { discardNewStorePaymentProduct, StorePaymentError, syncStorePaymentProduct } from "@/lib/payments/store-product"
import { eventAddOnInputsSchema, snapshotEventAddOns, type EventAddOn } from "@/lib/event-add-ons"
import { syncEventAddOnProducts } from "@/lib/payments/event-add-ons"

const createSchema = z.object({
  ...eventProductFields,
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  descriptionEn: z.string().min(1).optional().nullable(),
  descriptionAr: z.string().min(1).optional().nullable(),
  price: z.number().finite().min(0).max(99999999.99),
  pointsCost: z.number().int().min(0).optional().nullable(),
  stock: z.number().int().min(0),
  categoryId: z.string().uuid(),
  creationId: z.string().uuid().optional(),
  imageUrl: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  eventAddOns: eventAddOnInputsSchema.default([]),
})

export async function POST(req: NextRequest) {
  await requirePermission("store:write")
  let paymentProduct: { id: string; created: boolean } | undefined
  let localId: string | undefined
  const createdAddOnProducts: string[] = []
  try {
    requireSameOrigin(req)
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 })

    const data = parsed.data
    if (data.productType !== "event_ticket" && data.eventAddOns.length) {
      return NextResponse.json({ error: "Add-ons require an event" }, { status: 400 })
    }
    if (data.productType === "event_ticket") {
      await requireEventUser(true)
      getTicketSigningKey()
      if (!validEventWindow(data)) return NextResponse.json({ error: "Invalid event dates or location" }, { status: 400 })
    }
    localId = data.creationId || randomUUID()
    const existing = await db.query.products.findFirst({ where: eq(products.id, localId) })
    if (existing) {
      if (!existing.streamProductId || existing.nameEn !== data.nameEn || Number(existing.price) !== Number(data.price.toFixed(2))
        || existing.productType !== data.productType
        || JSON.stringify(snapshotEventAddOns(existing.eventAddOns)) !== JSON.stringify(snapshotEventAddOns(data.eventAddOns.map((option) => ({
          ...option, price: option.price.toFixed(2), streamProductId: null,
        }))))) {
        return NextResponse.json({ error: "CREATION_CONFLICT" }, { status: 409 })
      }
      return NextResponse.json({ success: true, id: existing.id, streamProductId: existing.streamProductId })
    }
    paymentProduct = await syncStorePaymentProduct({ name: data.nameEn, price: data.price.toFixed(2) })
    const eventAddOns = await syncEventAddOnProducts(data.eventAddOns, [], createdAddOnProducts)
    const [created] = await db
      .insert(products)
      .values({
        id: localId,
        nameEn: data.nameEn,
        nameAr: data.nameAr,
        descriptionEn: data.descriptionEn || null,
        descriptionAr: data.descriptionAr || null,
        price: data.price.toFixed(2),
        pointsCost: data.pointsCost ?? null,
        stockQuantity: data.stock,
        categoryId: data.categoryId,
        streamProductId: paymentProduct.id,
        imageUrl: data.imageUrl || null,
        isActive: data.isActive,
        productType: data.productType,
        eventStartsAt: data.productType === "event_ticket" ? new Date(data.eventStartsAt!) : null,
        eventEndsAt: data.productType === "event_ticket" ? new Date(data.eventEndsAt!) : null,
        eventLocation: data.productType === "event_ticket" ? data.eventLocation : null,
        eventAddOns,
      })
      .returning({ id: products.id })

    return NextResponse.json({ success: true, id: created?.id, streamProductId: paymentProduct.id })
  } catch (e) {
    if (createdAddOnProducts.length && localId) {
      const persisted = await db.query.products.findFirst({ where: eq(products.id, localId) })
        .then((row: { eventAddOns: EventAddOn[] } | undefined) => ({ savedIds: new Set(row?.eventAddOns.map((option) => option.streamProductId) ?? []) })).catch(() => null)
      // An uncertain database write must not delete products that might have been saved.
      if (persisted) {
        for (const id of createdAddOnProducts) if (!persisted.savedIds.has(id)) await discardNewStorePaymentProduct(id)
      }
    }
    if (paymentProduct?.created && localId) {
      const persisted = await db.query.products.findFirst({ where: eq(products.id, localId) })
        .then((row: any) => ({ found: !!row, paymentId: row?.streamProductId })).catch(() => null)
      if (persisted && (!persisted.found || persisted.paymentId !== paymentProduct.id)) {
        await discardNewStorePaymentProduct(paymentProduct.id)
      }
    }
    if (e instanceof StorePaymentError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: "Failed to create store item" }, { status: (e as any).status || 500 })
  }
}

export async function GET() {
  await requirePermission("store:read")
  const rows = await db.query.products.findMany({
    orderBy: [desc(products.createdAt)],
  })
  return NextResponse.json(rows)
}
