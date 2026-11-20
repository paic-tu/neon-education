import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import Module from "node:module"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import * as schema from "../lib/db/schema"
import {
  checkoutItemKey, eventAddOnInputsSchema, eventItemUnitPrice, moneyInHalalas,
  resolveEventAddOns, snapshotEventAddOns, type EventAddOn,
} from "../lib/event-add-ons"
import { syncEventAddOnProducts } from "../lib/payments/event-add-ons"
import { buildPaymentReceipt } from "../lib/payments/payment-email-content"

test("تسعير الإضافات من بيانات الفعالية ورفض التلاعب", () => {
  const dinner: EventAddOn = { id: randomUUID(), nameAr: "عشاء", nameEn: "Dinner", price: "25.50", streamProductId: randomUUID() }
  assert.equal(eventItemUnitPrice("1.00", resolveEventAddOns([dinner], [dinner.id])), "26.50")
  assert.equal(eventItemUnitPrice("0.10", [{ ...dinner, price: "0.20" }]), "0.30")
  assert.throws(() => resolveEventAddOns([dinner], [randomUUID()]))
  assert.throws(() => resolveEventAddOns([dinner], [dinner.id, dinner.id]))
  assert.throws(() => resolveEventAddOns([dinner], [{ id: dinner.id, price: "0.00" }]))
  for (const value of ["-1", "NaN", "Infinity", "0.001"]) assert.throws(() => moneyInHalalas(value))
  assert(!eventAddOnInputsSchema.safeParse([{ id: dinner.id, nameAr: "", nameEn: "Dinner", price: 25 }]).success)
  assert(!eventAddOnInputsSchema.safeParse([{ ...dinner, price: 1.001 }]).success)
})

test("حفظ نسخة المزايا وعدم إعادة استخدام رابط الدفع عند تغيّرها", () => {
  const option: EventAddOn = { id: randomUUID(), nameAr: "عشاء", nameEn: "Dinner", price: "25.00", streamProductId: randomUUID() }
  const snapshot = snapshotEventAddOns([option])
  const before = checkoutItemKey({ productId: "event", price: "26.00", quantity: 2, selectedAddOns: snapshot })
  option.nameAr = "اسم جديد"
  option.price = "30.00"
  assert.equal(snapshot[0].price, "25.00")
  assert.equal(snapshot[0].nameAr, "عشاء")
  assert(!("streamProductId" in snapshot[0]))
  assert.notEqual(before, checkoutItemKey({ productId: "event", price: "31.00", quantity: 2, selectedAddOns: snapshotEventAddOns([option]) }))
  assert.notEqual(before, checkoutItemKey({ productId: "event", price: "1.00", quantity: 2, selectedAddOns: [] }))
})

test("الإضافات المدفوعة ترتبط بالبوابة والمجانية لا تنشئ منتج دفع", async () => {
  const created: string[] = []
  let calls = 0
  const options = await syncEventAddOnProducts([
    { id: randomUUID(), nameAr: "عشاء", nameEn: "Dinner", price: 25 },
    { id: randomUUID(), nameAr: "شارة", nameEn: "Badge", price: 0 },
  ], [], created, async (input) => {
    calls++
    assert.equal(input.price, "25.00")
    return { id: randomUUID(), created: true }
  })
  assert.equal(calls, 1)
  assert.equal(created.length, 1)
  assert.equal(options[0].streamProductId, created[0])
  assert.equal(options[1].streamProductId, null)
})

test("الإيصال يعرض الإضافات المختارة ضمن قالب نيون مع ترميز النص", async () => {
  const receipt = await buildPaymentReceipt({
    id: randomUUID(), name: "Buyer", totalAmount: "26.00", paidAt: new Date(), paymentProvider: "stream", ticketCount: 1,
    items: [{ name: "Event", quantity: 1, price: "26.00", isEventTicket: true,
      selectedAddOns: [{ id: randomUUID(), nameAr: "عشاء <script>", nameEn: "Dinner", price: "25.00", noteAr: "وجبة واحدة <script>" }] }],
  })
  assert(receipt.text.includes("25.00"))
  assert(receipt.text.includes("عشاء"))
  assert(receipt.text.includes("وجبة واحدة"))
  assert(!receipt.html.includes("<script>"))
})

test("اختيار الإضافات يتطلب ملكية السلة والدفع يحفظ السعر والاختيار الصحيحين", async (t) => {
  const pg = new PGlite()
  const realDb = drizzle(pg)
  const userId = randomUUID(), otherUser = randomUUID(), cartId = randomUUID(), cartItemId = randomUUID(), productId = randomUUID()
  const dinner: EventAddOn = { id: randomUUID(), nameAr: "وجبة عشاء", nameEn: "Dinner", price: "25.50", streamProductId: randomUUID() }
  const free: EventAddOn = { id: randomUUID(), nameAr: "شارة", nameEn: "Badge", price: "0.00", streamProductId: null }
  let actor: string | null = userId
  let currentOptions = [dinner, free]
  let existingOrder: any = null, savedOrder: any, savedItems: any[], linkInput: any
  let links = 0
  const mockDb: any = {
    select: realDb.select.bind(realDb),
    query: {
      users: { findFirst: async () => ({ id: userId, name: "Buyer", email: "buyer@example.test", preferences: {}, streamConsumerId: "consumer" }) },
      carts: { findFirst: async () => {
        const { rows } = await pg.query<{ selected_add_on_ids: string[] }>("SELECT selected_add_on_ids FROM cart_items WHERE id=$1", [cartItemId])
        return { id: cartId, items: [{ id: cartItemId, courseId: null, productId, quantity: 2,
          selectedAddOnIds: rows[0].selected_add_on_ids, course: null,
          product: { id: productId, price: "1.00", nameEn: "Event", productType: "event_ticket", isActive: true,
            eventEndsAt: new Date(Date.now() + 86400000), streamProductId: "base-product", eventAddOns: currentOptions } }] }
      } },
      orders: { findFirst: async () => existingOrder },
    },
    insert: () => ({ values: (value: any) => ({ value }) }),
    batch: async (queries: any[]) => { savedOrder = queries[0].value; savedItems = queries[1].value },
    update: (table: unknown) => table === schema.cartItems ? realDb.update(schema.cartItems)
      : { set: () => ({ where: async () => [] }) },
  }
  const mocks: Record<string, unknown> = {
    "@/lib/db": { db: mockDb },
    "@/lib/auth": { auth: async () => actor ? { user: { id: actor } } : null },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/payments/stream": {
      getAppBaseUrl: () => "https://neonedu.org", normalizeSaudiPhone: (value: string) => value,
      streamRequest: async () => { throw new Error("Unexpected API call") },
      createStreamPaymentLink: async (input: any) => {
        links++; linkInput = input
        return { id: randomUUID(), url: "https://checkout.example.test", amount: savedOrder.totalAmount, original_amount: savedOrder.totalAmount }
      },
    },
    "@/lib/payments/checkout-consumer": {
      ensureCheckoutConsumer: async () => "consumer",
      withConsumerRecovery: async (id: string, create: (id: string) => Promise<unknown>) => create(id),
    },
    "@/lib/event-ticket-code": { getTicketSigningKey: () => "test" },
    "@/lib/events": { issueEventTickets: async () => [] },
    "@/lib/payments/payment-notifications": { notifyPaidOrder: async () => true, notifyCouponOrderWithRetry: async () => true },
  }
  const originalLoad = (Module as any)._load
  const previousKey = process.env.STREAM_API_KEY_BASE64
  try {
    await pg.exec(`
      CREATE TABLE products (id UUID PRIMARY KEY, product_type TEXT);
      CREATE TABLE carts (id UUID PRIMARY KEY, user_id UUID);
      CREATE TABLE cart_items (id UUID PRIMARY KEY, cart_id UUID, product_id UUID);
      CREATE TABLE order_items (id UUID PRIMARY KEY);
    `)
    const migration = readFileSync(new URL("../lib/db/migrations/0015_add_event_add_ons.sql", import.meta.url), "utf8")
    await pg.exec(migration)
    await pg.exec(migration)
    await pg.query("INSERT INTO products (id,product_type,event_add_ons) VALUES ($1,'event_ticket',$2::jsonb)", [productId, JSON.stringify(currentOptions)])
    await pg.query("INSERT INTO carts VALUES ($1,$2)", [cartId, userId])
    await pg.query("INSERT INTO cart_items (id,cart_id,product_id) VALUES ($1,$2,$3)", [cartItemId, cartId, productId])
    process.env.STREAM_API_KEY_BASE64 = "test"
    ;(Module as any)._load = function (request: string, ...args: unknown[]) {
      return request in mocks ? mocks[request] : originalLoad.call(this, request, ...args)
    }
    const { checkoutAction, updateCartItemAddOnsAction } = await import("../lib/actions/cart")
    await t.test("رفض الزائر وحساب آخر والإضافات غير المعروفة والمكررة", async () => {
      actor = null
      assert((await updateCartItemAddOnsAction(cartItemId, [dinner.id])).error)
      actor = otherUser
      assert((await updateCartItemAddOnsAction(cartItemId, [dinner.id])).error)
      actor = userId
      assert((await updateCartItemAddOnsAction(cartItemId, [randomUUID()])).error)
      assert((await updateCartItemAddOnsAction(cartItemId, [dinner.id, dinner.id])).error)
    })
    await t.test("تسعير الإضافات لكل تذكرة وإرسال منتجاتها للبوابة وحفظها في الطلب", async () => {
      assert((await updateCartItemAddOnsAction(cartItemId, [dinner.id, free.id])).success)
      assert((await checkoutAction()).success)
      assert.equal(savedOrder.totalAmount, "53")
      assert.equal(savedItems![0].price, "26.5")
      assert.equal(savedItems![0].quantity, 2)
      assert.deepEqual(savedItems![0].selectedAddOns, snapshotEventAddOns(resolveEventAddOns(currentOptions, [dinner.id, free.id])))
      assert.deepEqual(linkInput.items, [{ productId: "base-product", quantity: 2 }, { productId: dinner.streamProductId, quantity: 2 }])
      existingOrder = { ...savedOrder, paymentLinkUrl: "https://existing.example.test", items: savedItems!, discountAmount: "0" }
    })
    await t.test("نفس الاختيارات تعيد استخدام الرابط لكن تغييرها ينشئ رابطا جديدا", async () => {
      assert.equal((await checkoutAction()).checkoutUrl, "https://existing.example.test")
      assert.equal(links, 1)
      assert((await updateCartItemAddOnsAction(cartItemId, [free.id])).success)
      assert.equal((await checkoutAction()).checkoutUrl, "https://checkout.example.test")
      assert.equal(links, 2)
      assert.equal(savedItems![0].price, "1")
      assert.deepEqual(linkInput.items, [{ productId: "base-product", quantity: 2 }])
    })
    await t.test("تغيير سعر الإضافة لا يعيد رابط الدفع السابق أو يغيّر النسخة المحفوظة", async () => {
      assert((await updateCartItemAddOnsAction(cartItemId, [dinner.id, free.id])).success)
      currentOptions = [{ ...dinner, price: "30.00", streamProductId: randomUUID() }, free]
      assert((await checkoutAction()).success)
      assert.equal(links, 3)
      assert.equal(savedItems![0].price, "31")
      assert.equal(existingOrder.items[0].selectedAddOns.find((option: EventAddOn) => option.id === dinner.id).price, "25.50")
    })
    await t.test("اختيار إضافة أزيلت من الفعالية يمنع إنشاء الدفع", async () => {
      assert((await updateCartItemAddOnsAction(cartItemId, [dinner.id])).success)
      currentOptions = []
      assert((await checkoutAction()).error)
      assert.equal(links, 3)
    })
  } finally {
    ;(Module as any)._load = originalLoad
    if (previousKey === undefined) delete process.env.STREAM_API_KEY_BASE64
    else process.env.STREAM_API_KEY_BASE64 = previousKey
    await pg.close()
  }
})
