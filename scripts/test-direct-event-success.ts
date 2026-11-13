import { test } from "node:test"
import assert from "node:assert/strict"
import Module from "node:module"
import { DIRECT_EVENT_ORDER_NOTE } from "../lib/payments/checkout-mode"

test("confirmed direct event redirects to tickets without clearing an existing cart", async () => {
  const id = "9ab24041-5cf8-426d-9669-bbaac28ec692"
  let deletes = 0
  let issued = 0
  let updated = true
  const db: any = {
    query: {
      orders: { findFirst: async () => ({ id, status: updated ? "pending" : "paid", notes: DIRECT_EVENT_ORDER_NOTE }) },
      orderItems: { findMany: async () => [{ isEventTicket: true, courseId: null }] },
      carts: { findFirst: async () => ({ id: "cart" }) },
    },
    update: () => ({ set: () => ({ where: () => ({ returning: async () => updated ? [{ id }] : [] }) }) }),
    delete: () => ({ where: async () => { deletes++ } }),
  }
  const mocks: Record<string, unknown> = {
    "@/lib/db": { db },
    "@/lib/auth": { getCurrentUser: async () => ({ id: "buyer" }) },
    "@/lib/payments/verify-order": { verifyOrderViaStream: async () => ({ state: "paid", paymentId: "payment", invoiceId: "invoice" }) },
    "@/lib/events": { issueEventTickets: async () => { issued++ } },
    "@/lib/payments/payment-notifications": { notifyPaidOrder: async () => true },
    "next/navigation": { redirect: (url: string) => { throw Object.assign(new Error("redirect"), { url }) } },
    "next/link": () => null,
  }
  const originalLoad = (Module as any)._load
  try {
    ;(Module as any)._load = function (request: string, ...args: unknown[]) {
      if (request in mocks) return mocks[request]
      if (request.startsWith("@/components/")) return new Proxy({}, { get: () => () => null })
      return originalLoad.call(this, request, ...args)
    }
    const { default: page } = await import("../app/[lang]/checkout/stream/success/page")
    const props = { params: Promise.resolve({ lang: "ar" }), searchParams: Promise.resolve({ order_id: id }) }
    await assert.rejects(page(props), (error: any) => error.url === `/ar/tickets/${id}`)
    assert.equal(deletes, 0)
    assert.equal(issued, 1)
    updated = false
    await assert.rejects(page(props), (error: any) => error.url === `/ar/tickets/${id}`)
    assert.equal(deletes, 0)
    assert.equal(issued, 2)
  } finally {
    ;(Module as any)._load = originalLoad
  }
})
