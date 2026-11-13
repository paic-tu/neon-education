import { test } from "node:test"
import assert from "node:assert/strict"
import Module from "node:module"
import { DIRECT_EVENT_ORDER_NOTE, isDirectEventOrder } from "../lib/payments/checkout-mode"

test("direct event checkout creates an isolated order without reading or clearing the cart", async () => {
  const productId = "9ab24041-5cf8-426d-9669-bbaac28ec692"
  const userId = "82d98790-1956-4f64-8964-97ac901cab48"
  let savedOrder: any
  let savedItems: any
  let linkInput: any
  let cartReads = 0
  let deletes = 0
  let linkAmount = "1.00"
  let receiptSent = true
  let issued = 0
  let notified = 0
  const db: any = {
    query: {
      users: { findFirst: async () => ({ id: userId, name: "Buyer", email: "buyer@example.test", preferences: {}, streamConsumerId: "consumer" }) },
      products: { findFirst: async () => ({ id: productId, nameEn: "Event", price: "1.00", isActive: true, productType: "event_ticket", eventEndsAt: new Date(Date.now() + 86400000), streamProductId: "stream-product" }) },
      carts: { findFirst: async () => { cartReads++; throw new Error("cart must not be read") } },
      orders: { findFirst: async () => null },
    },
    insert: () => ({ values: (value: any) => ({ value }) }),
    batch: async (queries: any[]) => { savedOrder = queries[0].value; savedItems = queries[1].value },
    update: () => ({ set: () => ({ where: async () => [] }) }),
    delete: () => { deletes++; throw new Error("cart must not be deleted") },
  }
  const mocks: Record<string, unknown> = {
    "@/lib/db": { db },
    "@/lib/auth": { auth: async () => ({ user: { id: userId } }) },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/payments/stream": {
      getAppBaseUrl: () => "https://neonedu.org",
      normalizeSaudiPhone: (value: string) => value,
      streamRequest: async (path: string) => {
        if (path.startsWith("/coupons/")) return { id: "coupon", is_active: true, discount_value: "100", is_percentage: true }
        throw new Error("unexpected Stream request")
      },
      createStreamPaymentLink: async (input: any) => {
        linkInput = input
        return { id: "link", url: "https://checkout.example.test", amount: linkAmount }
      },
    },
    "@/lib/payments/checkout-consumer": {
      ensureCheckoutConsumer: async () => "consumer",
      withConsumerRecovery: async (id: string, create: (id: string) => Promise<unknown>) => create(id),
    },
    "@/lib/event-ticket-code": { getTicketSigningKey: () => "test" },
    "@/lib/events": { issueEventTickets: async () => { issued++ } },
    "@/lib/payments/payment-notifications": {
      notifyPaidOrder: async () => true,
      notifyCouponOrderWithRetry: async () => { notified++; return receiptSent },
    },
  }
  const originalLoad = (Module as any)._load
  const originalKey = process.env.STREAM_API_KEY_BASE64
  process.env.STREAM_API_KEY_BASE64 = "test"
  try {
    ;(Module as any)._load = function (request: string, ...args: unknown[]) {
      return request in mocks ? mocks[request] : originalLoad.call(this, request, ...args)
    }
    const { checkoutAction } = await import("../lib/actions/cart")
    const result = await checkoutAction(undefined, undefined, "ar", null, productId)
    assert.equal(result.checkoutUrl, "https://checkout.example.test")
    assert.equal(savedOrder.notes, DIRECT_EVENT_ORDER_NOTE)
    assert.equal(savedOrder.userId, userId)
    assert.equal(savedOrder.status, "pending")
    assert.equal(savedItems.length, 1)
    assert.equal(savedItems[0].productId, productId)
    assert.equal(savedItems[0].quantity, 1)
    assert.deepEqual(linkInput.items, [{ productId: "stream-product", quantity: 1 }])
    assert.equal(cartReads, 0)
    assert.equal(deletes, 0)
    assert(isDirectEventOrder(savedOrder.notes))
    assert(!isDirectEventOrder(null))
    assert((await checkoutAction(undefined, undefined, "ar", null, "invalid")).error)
    linkAmount = "0.00"
    receiptSent = false
    const discounted = await checkoutAction(undefined, undefined, "ar", ["coupon"], productId)
    assert.equal(discounted.success, true)
    assert.equal(discounted.receiptSent, false)
    assert.equal(issued, 1)
    assert.equal(notified, 1)
    assert.equal(cartReads, 0)
    assert.equal(deletes, 0)
  } finally {
    ;(Module as any)._load = originalLoad
    if (originalKey === undefined) delete process.env.STREAM_API_KEY_BASE64
    else process.env.STREAM_API_KEY_BASE64 = originalKey
  }
})
