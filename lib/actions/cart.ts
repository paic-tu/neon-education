"use server"

import { db } from "@/lib/db"
import { 
  carts, 
  cartItems, 
  orders, 
  orderItems, 
  enrollments,
  users,
  products,
} from "@/lib/db/schema"
import { auth } from "@/lib/auth"
import { and, desc, eq, isNotNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { createStreamPaymentLink, getAppBaseUrl, normalizeSaudiPhone, streamRequest } from "@/lib/payments/stream"
import { ensureCheckoutConsumer, withConsumerRecovery } from "@/lib/payments/checkout-consumer"
import { getTicketSigningKey } from "@/lib/event-ticket-code"
import { issueEventTickets } from "@/lib/events"
import { randomUUID } from "node:crypto"
import { notifyCouponOrderWithRetry, notifyPaidOrder } from "@/lib/payments/payment-notifications"
import { DIRECT_EVENT_ORDER_NOTE, isDirectEventOrder } from "@/lib/payments/checkout-mode"
import { z } from "zod"
import { checkoutItemKey, eventAddOnIdsSchema, eventItemUnitPrice, moneyInHalalas, resolveEventAddOns, snapshotEventAddOns, type SelectedEventAddOn } from "@/lib/event-add-ons"

function normalizeCouponIds(input: unknown): string[] {
  if (!input) return []
  if (Array.isArray(input)) {
    return Array.from(new Set(input.map((x) => String(x || "").trim()).filter(Boolean))).sort()
  }
  if (typeof input === "string") {
    const s = input.trim()
    if (!s) return []
    try {
      const parsed = JSON.parse(s)
      return normalizeCouponIds(parsed)
    } catch {
      return [s]
    }
  }
  return []
}

function estimateDiscount(total: number, coupon: { isPercentage: boolean; discountValue: number }) {
  if (!Number.isFinite(total) || total <= 0) return 0
  const dv = Number(coupon.discountValue) || 0
  if (!Number.isFinite(dv) || dv <= 0) return 0
  const raw = coupon.isPercentage ? total * (dv / 100) : dv
  const capped = Math.max(0, Math.min(total, raw))
  return Number(capped.toFixed(2))
}

async function ensureValidCouponsWithDetails(couponIds: unknown) {
  const ids = normalizeCouponIds(couponIds)
  if (ids.length === 0) return { ids: [], details: [] as Array<{ id: string; isPercentage: boolean; discountValue: number }> }

  const details: Array<{ id: string; isPercentage: boolean; discountValue: number }> = []
  for (const id of ids) {
    const c = await streamRequest<any>(`/coupons/${encodeURIComponent(id)}`, { method: "GET" })
    if (!c?.id) throw new Error("Invalid coupon")
    if (c?.is_active === false) throw new Error("Coupon is inactive")
    const discountValue = Number.parseFloat(String(c?.discount_value))
    const isPercentage = Boolean(c?.is_percentage)
    if (!Number.isFinite(discountValue) || discountValue <= 0) throw new Error("Invalid coupon")
    details.push({ id: String(c.id), isPercentage, discountValue })
  }
  return { ids: details.map((d) => d.id), details }
}

function extractCouponIdsFromGatewayPayload(payload: any) {
  if (!payload) return []
  const fromTop = normalizeCouponIds(payload?.coupons)
  if (fromTop.length > 0) return fromTop
  const items = Array.isArray(payload?.items) ? payload.items : []
  for (const it of items) {
    const ids = normalizeCouponIds((it as any)?.coupons)
    if (ids.length > 0) return ids
  }
  return []
}

export async function getCartAction() {
  console.log("[Action] getCartAction started")
  try {
    const session = await auth()
    if (!session?.user?.id) {
        console.log("[Action] Unauthorized getCart")
        return { error: "Unauthorized" }
    }

    const userId = session.user.id

    // Use a simpler query first to debug
    // Ensure carts table exists and userId is valid
    let cart = await db.query.carts.findFirst({
      where: eq(carts.userId, userId),
      with: {
        items: {
          with: {
            course: true,
            product: true,
          }
        }
      }
    })

    if (!cart) {
      console.log("[Action] Cart not found, creating new one for user:", userId)
      const [newCart] = await db.insert(carts).values({ userId }).returning()
      if (!newCart) {
         throw new Error("Failed to create new cart")
      }
      return { cart: { ...newCart, items: [] } }
    }

    return { cart }
  } catch (error) {
    console.error("[Action] getCartAction error:", error)
    // Don't expose internal errors to client, but log them
    return { error: "Failed to get cart" }
  }
}

export async function getCartCountAction() {
  console.log("[Action] getCartCountAction started")
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { count: 0 }
    }

    const userId = session.user.id

    const cart = await db.query.carts.findFirst({
      where: eq(carts.userId, userId),
      columns: { id: true },
      with: {
        items: { columns: { id: true } },
      },
    })

    return { count: cart?.items?.length ?? 0 }
  } catch (error) {
    console.error("[Action] getCartCountAction error:", error)
    return { count: 0 }
  }
}

export async function addToCartAction(itemId: string, type: "course" | "product" = "course") {
  console.log("[Action] addToCartAction started", { itemId, type })
  try {
    const session = await auth()
    if (!session?.user?.id) {
        console.log("[Action] Unauthorized addToCart")
        return { error: "Unauthorized" }
    }

    const userId = session.user.id

    // Get or create cart
    let cart = await db.query.carts.findFirst({
      where: eq(carts.userId, userId)
    })

    if (!cart) {
      const [newCart] = await db.insert(carts).values({ userId }).returning()
      cart = newCart
    }

    // Check if item exists
    const whereClause = type === "course" 
      ? and(eq(cartItems.cartId, cart.id), eq(cartItems.courseId, itemId))
      : and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, itemId))

    const existingItem = await db.query.cartItems.findFirst({
      where: whereClause
    })

    if (existingItem) {
      return { success: true, message: "Already in cart" }
    }

    await db.insert(cartItems).values({
      cartId: cart.id,
      courseId: type === "course" ? itemId : null,
      productId: type === "product" ? itemId : null,
      quantity: 1
    })

    revalidatePath("/cart")
    return { success: true, message: "Added to cart" }
  } catch (error) {
    console.error("[Action] addToCartAction error:", error)
    return { error: "Failed to add to cart" }
  }
}

export async function removeFromCartAction(itemId: string) {
  console.log("[Action] removeFromCartAction started", { itemId })
  try {
    const session = await auth()
    if (!session?.user?.id) {
        console.log("[Action] Unauthorized removeFromCart")
        return { error: "Unauthorized" }
    }

    await db.delete(cartItems).where(eq(cartItems.id, itemId))
    revalidatePath("/cart")
    revalidatePath("/ar/cart")
    revalidatePath("/en/cart")
    return { success: true }
  } catch (error) {
    console.error("[Action] removeFromCartAction error:", error)
    return { error: "Failed to remove from cart" }
  }
}

export async function updateCartItemQuantityAction(cartItemId: string, quantity: number) {
  console.log("[Action] updateCartItemQuantityAction started", { cartItemId, quantity })
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }
    const userId = session.user.id

    const q = Number(quantity)
    if (!Number.isInteger(q) || q < 1 || q > 99) {
      return { error: "Invalid quantity" }
    }

    const item = await db.query.cartItems.findFirst({
      where: eq(cartItems.id, cartItemId),
      columns: { id: true, cartId: true },
    })
    if (!item) return { error: "Cart item not found" }

    const cart = await db.query.carts.findFirst({
      where: and(eq(carts.id, item.cartId), eq(carts.userId, userId)),
      columns: { id: true },
    })
    if (!cart) return { error: "Unauthorized" }

    await db.update(cartItems).set({ quantity: q }).where(eq(cartItems.id, item.id))

    revalidatePath("/cart")
    revalidatePath("/ar/cart")
    revalidatePath("/en/cart")
    return { success: true }
  } catch (error) {
    console.error("[Action] updateCartItemQuantityAction error:", error)
    return { error: "Failed to update quantity" }
  }
}

export async function updateCartItemAddOnsAction(cartItemId: string, selectedIds: string[]) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }
    const id = z.string().uuid().parse(cartItemId)
    const ids = eventAddOnIdsSchema.parse(selectedIds)
    const [item] = await db.select({
      id: cartItems.id, cartId: cartItems.cartId, productType: products.productType, eventAddOns: products.eventAddOns,
    }).from(cartItems).innerJoin(carts, eq(carts.id, cartItems.cartId))
      .innerJoin(products, eq(products.id, cartItems.productId))
      .where(and(eq(cartItems.id, id), eq(carts.userId, session.user.id))).limit(1)
    if (!item || item.productType !== "event_ticket") return { error: "Event cart item not found" }
    const selected = resolveEventAddOns(item.eventAddOns, ids).map((option) => option.id)
    await db.update(cartItems).set({ selectedAddOnIds: selected })
      .where(and(eq(cartItems.id, item.id), eq(cartItems.cartId, item.cartId)))
    revalidatePath("/ar/cart")
    revalidatePath("/en/cart")
    return { success: true, selectedAddOnIds: selected }
  } catch {
    return { error: "تعذر حفظ الإضافات. حدّث السلة وأعد المحاولة / Unable to save add-ons. Refresh and retry." }
  }
}

export async function validateCouponAction(code: string) {
  console.log("[Action] validateCouponAction started")
  try {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    const shouldUseStream = Boolean(process.env.STREAM_API_KEY_BASE64 || (process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET))
    if (!shouldUseStream) return { error: "Stream is not configured" }

    const raw = String(code || "").trim()
    if (!raw) return { error: "Invalid coupon" }

    const res = await streamRequest<any>(`/coupons?search_term=${encodeURIComponent(raw)}&active=true&limit=10`, { method: "GET" })
    const list: any[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
    const found =
      list.find((c) => String(c?.name || "").trim().toLowerCase() === raw.toLowerCase()) ||
      list.find((c) => String(c?.name || "").trim().toLowerCase().includes(raw.toLowerCase())) ||
      null

    if (!found?.id) return { error: "Coupon not found" }
    if (found?.is_active === false) return { error: "Coupon is inactive" }

    const discountValue = Number.parseFloat(String(found?.discount_value))
    const isPercentage = Boolean(found?.is_percentage)
    if (!Number.isFinite(discountValue) || discountValue <= 0) return { error: "Invalid coupon" }

    return {
      success: true,
      coupon: {
        id: String(found.id),
        name: String(found.name || raw),
        isPercentage,
        discountValue,
        currency: String(found?.currency || "SAR"),
      },
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to validate coupon" }
  }
}

export async function checkoutAction(shippingAddress?: string, notes?: string, lang: string = "ar", couponIds?: string[] | null, directEventId?: string) {
    console.log("[Action] checkoutAction started")
    try {
        const session = await auth()
        if (!session?.user?.id) {
            console.log("[Action] Unauthorized checkout attempt")
            return { error: "Unauthorized" }
        }
        const userId = session.user.id

        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { id: true, name: true, email: true, phoneNumber: true, phone: true, preferences: true, streamConsumerId: true },
        })
        if (!user) return { error: "User not found" }

        // Get cart with items and prices
        if (directEventId && !z.string().uuid().safeParse(directEventId).success) return { error: "Invalid event" }
        const directProduct = directEventId ? await db.query.products.findFirst({
          where: eq(products.id, directEventId),
        }) : null
        if (directEventId && (!directProduct || !directProduct.isActive || directProduct.productType !== "event_ticket")) {
          return { error: lang === "ar" ? "الفعالية غير متاحة" : "Event is unavailable" }
        }
        const existingCart = directEventId ? null : await db.query.carts.findFirst({
            where: eq(carts.userId, userId),
            with: {
                items: {
                    with: {
                        course: true,
                        product: true
                    }
                }
            }
        })
        const cart = directProduct
          ? { id: "", items: [{ course: null, product: directProduct, courseId: null, productId: directProduct.id, quantity: 1, selectedAddOnIds: [] as string[] }] }
          : existingCart

        if (!cart || cart.items.length === 0) {
            console.log("[Action] Checkout failed: Cart is empty")
            return { error: "Cart is empty" }
        }

        // Calculate total
        let total = 0
        const validItems: any[] = []

        for (const item of cart.items) {
            let price = 0
            const qty = item.quantity || 1
            if (!Number.isInteger(qty) || qty < 1 || qty > 99) return { error: "Invalid quantity" }
            if (item.course) {
                price = moneyInHalalas(item.course.price || "0") / 100
                validItems.push({ type: 'course', id: item.course.id, price, title: item.course.titleEn, quantity: qty,
                  streamProductId: item.course.streamProductId, selectedAddOns: [], streamAddOns: [] })
            } else if (item.product) {
                if (!item.product.isActive) return { error: "Product is unavailable" }
                if (item.product.productType === "event_ticket") {
                  getTicketSigningKey()
                  if (!item.product.eventEndsAt || new Date(item.product.eventEndsAt) <= new Date()) {
                    return { error: "Event ticket sales have ended" }
                  }
                }
                const options = item.product.productType === "event_ticket"
                  ? resolveEventAddOns(item.product.eventAddOns, item.selectedAddOnIds) : []
                if (item.product.productType !== "event_ticket" && item.selectedAddOnIds?.length) return { error: "Invalid add-ons" }
                const selectedAddOns = snapshotEventAddOns(options)
                price = Number(eventItemUnitPrice(item.product.price || "0", selectedAddOns))
                validItems.push({ type: 'product', id: item.product.id, price, title: item.product.nameEn, quantity: qty,
                  streamProductId: item.product.streamProductId, selectedAddOns, streamAddOns: options })
            }
            total = Number((total + price * qty).toFixed(2))
        }

        const shouldUseStream = Boolean(process.env.STREAM_API_KEY_BASE64 || (process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET))
        const hasEventTickets = cart.items.some((item: { product?: { productType?: string } | null }) => item.product?.productType === "event_ticket")

        if (!shouldUseStream) {
            if (hasEventTickets) return { error: "Event tickets require verified gateway payment" }
            const allowManual = process.env.ALLOW_MANUAL_CHECKOUT === "true"
            if (!allowManual) {
              return { error: "Payment is not configured (Stream keys missing)" }
            }

            const [order] = await db.insert(orders).values({
                userId,
                status: "paid",
                totalAmount: total.toString(),
                shippingAddress: shippingAddress || null,
                notes: notes || null,
                paymentProvider: "manual",
                paidAt: new Date(),
            }).returning()

            for (const item of validItems) {
                await db.insert(orderItems).values({
                    orderId: order.id,
                    courseId: item.type === 'course' ? item.id : null,
                    productId: item.type === 'product' ? item.id : null,
                    price: item.price.toString(),
                    quantity: item.quantity || 1
                })

                if (item.type === 'course') {
                     const existing = await db.query.enrollments.findFirst({
                         where: and(
                             eq(enrollments.userId, userId),
                             eq(enrollments.courseId, item.id)
                         )
                     })

                     if (!existing) {
                         await db.insert(enrollments).values({
                             userId,
                             courseId: item.id,
                             status: 'active'
                         })
                     }
                }
            }

            await db.delete(cartItems).where(eq(cartItems.cartId, cart.id))

            await notifyPaidOrder(order.id)
            revalidatePath("/cart")
            revalidatePath("/student/dashboard")
            revalidatePath("/ar/student/dashboard")
            revalidatePath("/en/student/dashboard")
            revalidatePath("/ar/student/my-courses")
            revalidatePath("/en/student/my-courses")
            return { success: true, orderId: order.id }
        }

        const itemsForStream: Array<{ productId: string; quantity: number }> = []
        for (const ci of validItems) {
            if (!ci.streamProductId) return { error: `Payment product is missing: ${ci.title}` }
            itemsForStream.push({ productId: ci.streamProductId, quantity: ci.quantity })
            for (const option of ci.streamAddOns) {
              if (moneyInHalalas(option.price) === 0) continue
              if (!option.streamProductId) return { error: "Event add-on payment product is missing" }
              itemsForStream.push({ productId: option.streamProductId, quantity: ci.quantity })
            }
        }

        const phoneRaw = user.phoneNumber || user.phone || ""
        const phoneE164 = phoneRaw ? normalizeSaudiPhone(phoneRaw) : ""
        const email = (user.email || "").trim().toLowerCase()
        const preferredLanguage = typeof user.preferences?.preferred_language === "string" ? user.preferences.preferred_language : lang

        const consumerInput = { userId: user.id, name: user.name, email, phone: phoneE164, preferredLanguage }
        const resolveConsumer = async (storedId?: string | null) => {
          const streamConsumerId = await ensureCheckoutConsumer({ ...consumerInput, storedId })
          if (streamConsumerId !== user.streamConsumerId) {
            await db.update(users).set({ streamConsumerId, updatedAt: new Date() }).where(eq(users.id, user.id))
          }
          return streamConsumerId
        }
        const streamConsumerId = await resolveConsumer(user.streamConsumerId)

        const existingOrder = await db.query.orders.findFirst({
          where: and(eq(orders.userId, userId), eq(orders.status, "pending"), eq(orders.paymentProvider, "stream"), isNotNull(orders.paymentLinkUrl)),
          orderBy: [desc(orders.createdAt)],
          with: { items: { columns: { courseId: true, productId: true, quantity: true, price: true, selectedAddOns: true } } },
          columns: {
            id: true,
            paymentLinkId: true,
            paymentLinkUrl: true,
            totalAmount: true,
            couponIds: true,
            gatewayPayload: true,
            notes: true,
            originalAmount: true,
            discountAmount: true,
          },
        })

        if (streamConsumerId === user.streamConsumerId && existingOrder?.paymentLinkUrl
          && isDirectEventOrder(existingOrder.notes) === Boolean(directEventId)
          && Array.isArray(existingOrder.items) && existingOrder.items.length > 0) {
          const cartKey = validItems
            .map((it) => checkoutItemKey({
              courseId: it.type === "course" ? it.id : null, productId: it.type === "product" ? it.id : null,
              quantity: it.quantity, price: it.price.toFixed(2), selectedAddOns: it.selectedAddOns,
            }))
            .slice()
            .sort()
            .join("|")
          const orderKey = existingOrder.items
            .map((it: { courseId: string | null; productId: string | null; quantity: number; price: string; selectedAddOns: SelectedEventAddOn[] }) => checkoutItemKey(it))
            .slice()
            .sort()
            .join("|")
          const requestedCoupons = normalizeCouponIds(couponIds)
          const existingCoupons =
            normalizeCouponIds(existingOrder.couponIds as any).length > 0
              ? normalizeCouponIds(existingOrder.couponIds as any)
              : extractCouponIdsFromGatewayPayload(existingOrder.gatewayPayload as any)
          const couponKey = requestedCoupons.join("|")
          const existingCouponKey = existingCoupons.join("|")
          const existingDiscountRaw = Number.parseFloat(String(existingOrder.discountAmount || "0"))
          const existingDiscount = Number.isFinite(existingDiscountRaw) ? existingDiscountRaw : 0
          const couponMismatch = couponKey !== existingCouponKey
          const couponRemovedButDiscounted = requestedCoupons.length === 0 && existingDiscount > 0
          if (cartKey && cartKey === orderKey && !couponMismatch && !couponRemovedButDiscounted) {
            const storedTotal = Number.parseFloat(String(existingOrder.totalAmount || ""))
            const payloadTotal = Number.parseFloat(String((existingOrder.gatewayPayload as any)?.amount || ""))
            const existingFinalTotal = Number.isFinite(storedTotal) ? storedTotal : Number.isFinite(payloadTotal) ? payloadTotal : null

            if (!hasEventTickets && existingFinalTotal !== null && existingFinalTotal <= 0) {
              await db
                .update(orders)
                .set({
                  status: "paid",
                  paidAt: new Date(),
                  gatewayStatus: "COUPON_FREE",
                  paymentProvider: "coupon",
                  updatedAt: new Date(),
                })
                .where(eq(orders.id, existingOrder.id))

              for (const item of validItems) {
                if (item.type !== "course") continue
                const existing = await db.query.enrollments.findFirst({
                  where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, item.id)),
                })
                if (!existing) {
                  await db.insert(enrollments).values({
                    userId,
                    courseId: item.id,
                    status: "active",
                  })
                }
              }

              await db.delete(cartItems).where(eq(cartItems.cartId, cart.id))
              const receiptSent = await notifyCouponOrderWithRetry(existingOrder.id)
              revalidatePath("/cart")
              revalidatePath("/ar/cart")
              revalidatePath("/en/cart")
              revalidatePath("/ar/student/my-courses")
              revalidatePath("/en/student/my-courses")
              return { success: true, orderId: existingOrder.id, receiptSent }
            }

            return { success: true, orderId: existingOrder.id, checkoutUrl: existingOrder.paymentLinkUrl }
          }
        }

        const verified = await ensureValidCouponsWithDetails(couponIds)
        const verifiedCouponIds = verified.ids
        const verifiedDetails = verified.details

        const safeTotal = Number.isFinite(total) ? total : 0
        const isFreeByCoupon = verifiedDetails.length === 1 ? safeTotal - estimateDiscount(safeTotal, verifiedDetails[0]) <= 0 : false
        const isAlreadyFree = safeTotal <= 0

        if (!hasEventTickets && (isAlreadyFree || isFreeByCoupon)) {
          const [order] = await db
            .insert(orders)
            .values({
              userId,
              status: "paid",
              totalAmount: "0.00",
              originalAmount: safeTotal.toFixed(2),
              discountAmount: safeTotal.toFixed(2),
              couponIds: verifiedCouponIds.length > 0 ? verifiedCouponIds : null,
              shippingAddress: shippingAddress || null,
              notes: notes || null,
              paymentProvider: "coupon",
              gatewayStatus: "COUPON_FREE",
              paidAt: new Date(),
            })
            .returning()

          for (const item of validItems) {
            await db.insert(orderItems).values({
              orderId: order.id,
              courseId: item.type === "course" ? item.id : null,
              productId: item.type === "product" ? item.id : null,
              price: item.price.toString(),
              quantity: item.quantity || 1,
            })

            if (item.type === "course") {
              const existing = await db.query.enrollments.findFirst({
                where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, item.id)),
              })
              if (!existing) {
                await db.insert(enrollments).values({
                  userId,
                  courseId: item.id,
                  status: "active",
                })
              }
            }
          }

          await db.delete(cartItems).where(eq(cartItems.cartId, cart.id))
          const receiptSent = await notifyCouponOrderWithRetry(order.id)
          revalidatePath("/cart")
          revalidatePath("/ar/cart")
          revalidatePath("/en/cart")
          revalidatePath("/ar/student/my-courses")
          revalidatePath("/en/student/my-courses")
          return { success: true, orderId: order.id, receiptSent }
        }

        const order = { id: randomUUID() }
        const orderData = {
                id: order.id,
                userId,
                status: "pending" as const,
                totalAmount: total.toString(),
                originalAmount: total.toString(),
                discountAmount: "0",
                couponIds: verifiedCouponIds.length > 0 ? verifiedCouponIds : null,
                shippingAddress: shippingAddress || null,
                notes: directEventId ? DIRECT_EVENT_ORDER_NOTE : (isDirectEventOrder(notes) ? null : notes || null),
                paymentProvider: "stream",
                gatewayStatus: "CREATED",
        }

        const itemData = validItems.map((item) => ({
                orderId: order.id,
                courseId: item.type === 'course' ? item.id : null,
                productId: item.type === 'product' ? item.id : null,
                price: item.price.toString(),
                quantity: item.quantity || 1,
                selectedAddOns: item.selectedAddOns,
        }))
        // حجز كل المقاعد مع الطلب ضمن معاملة واحدة، حتى لا تبقى حجوزات جزئية.
        if (typeof db.batch === "function") {
          await db.batch([db.insert(orders).values(orderData), db.insert(orderItems).values(itemData)])
        } else {
          await db.transaction(async (tx: any) => {
            await tx.insert(orders).values(orderData)
            await tx.insert(orderItems).values(itemData)
          })
        }
        const baseUrl = getAppBaseUrl()
        const successRedirectUrl = `${baseUrl}/${lang}/checkout/stream/success?order_id=${order.id}`
        const failureRedirectUrl = `${baseUrl}/${lang}/checkout/stream/failure?order_id=${order.id}`

        let paymentLink: any
        try {
            paymentLink = await withConsumerRecovery(streamConsumerId, (consumerId) => createStreamPaymentLink({
                name: `Neon Order ${order.id}`,
                currency: "SAR",
                maxNumberOfPayments: 1,
                organizationConsumerId: consumerId,
                contactInformationType: email ? "EMAIL" : "PHONE",
                successRedirectUrl,
                failureRedirectUrl,
                items: itemsForStream,
                couponIds: verifiedCouponIds.length > 0 ? verifiedCouponIds : undefined,
                customMetadata: {
                    order_id: order.id,
                    user_id: userId,
                    source: "neon_store",
                    user_name: user.name,
                    user_email: email || null,
                    user_phone: phoneE164 || null,
                    preferred_language: preferredLanguage || null,
                    coupon_ids: verifiedCouponIds.length > 0 ? verifiedCouponIds : null,
                },
            }), () => resolveConsumer())
        } catch (e) {
            await db.delete(orderItems).where(eq(orderItems.orderId, order.id))
            await db.delete(orders).where(eq(orders.id, order.id))
            console.error("[Checkout] Payment link creation failed", e instanceof Error ? e.name : "Unknown")
            return { error: lang === "ar" ? "تعذر تجهيز رابط الدفع. أعد المحاولة، وإذا استمرت المشكلة تواصل مع الدعم." : "Unable to prepare the payment link. Please retry or contact support." }
        }

        const streamAmount = Number.parseFloat(String((paymentLink as any)?.amount || ""))
        const streamOriginal = Number.parseFloat(String((paymentLink as any)?.original_amount || ""))
        const finalOriginal = Number.isFinite(streamOriginal) && streamOriginal > 0 ? streamOriginal : total
        const finalTotal = Number.isFinite(streamAmount) && streamAmount >= 0 ? streamAmount : total
        const finalDiscount = Math.max(0, Number((finalOriginal - finalTotal).toFixed(2)))

        await db.update(orders).set({
            paymentLinkId: paymentLink.id,
            paymentLinkUrl: paymentLink.url,
            gatewayStatus: paymentLink.status || "ACTIVE",
            branchId: process.env.STREAM_BRANCH_ID || null,
            gatewayPayload: paymentLink as any,
            totalAmount: finalTotal.toFixed(2),
            originalAmount: finalOriginal.toFixed(2),
            discountAmount: finalDiscount.toFixed(2),
            updatedAt: new Date(),
        }).where(eq(orders.id, order.id))

        if (finalTotal <= 0) {
          await db.update(orders).set({ status: "paid", paidAt: new Date(), gatewayStatus: "COUPON_FREE", paymentProvider: "coupon", updatedAt: new Date() }).where(eq(orders.id, order.id))

          for (const item of validItems) {
            if (item.type !== "course") continue
            const existing = await db.query.enrollments.findFirst({
              where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, item.id)),
            })
            if (!existing) {
              await db.insert(enrollments).values({
                userId,
                courseId: item.id,
                status: "active",
              })
            }
          }

          if (!directEventId) await db.delete(cartItems).where(eq(cartItems.cartId, cart.id))
          await issueEventTickets(order.id)
          const receiptSent = await notifyCouponOrderWithRetry(order.id)
          revalidatePath("/cart")
          revalidatePath("/ar/cart")
          revalidatePath("/en/cart")
          revalidatePath("/ar/student/my-courses")
          revalidatePath("/en/student/my-courses")
          return { success: true, orderId: order.id, receiptSent }
        }

        revalidatePath("/cart")
        revalidatePath("/ar/cart")
        revalidatePath("/en/cart")
        return { success: true, orderId: order.id, checkoutUrl: paymentLink.url }
    } catch (error) {
        console.error("[Action] checkoutAction error:", error)
        return { error: lang === "ar" ? "تعذر تجهيز الطلب. أعد المحاولة أو تواصل مع الدعم." : "Checkout failed. Please retry or contact support." }
    }
}
