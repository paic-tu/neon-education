import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { StorePaymentError, syncStorePaymentProduct } from "../lib/payments/store-product"

test("إنشاء منتج الدفع تلقائياً بالاسم والسعر الصحيحين", async () => {
  const id = randomUUID()
  const result = await syncStorePaymentProduct({ name: "neon ora", price: "1.00" }, async (path, init) => {
    assert.equal(path, "/products")
    assert.equal(init.method, "POST")
    assert.deepEqual(JSON.parse(String(init.body)), { name: "neon ora", type: "ONE_OFF", currency: "SAR", price: "1.00" })
    return { id, name: "neon ora", price: "1.00", currency: "SAR" }
  })
  assert.deepEqual(result, { id, created: true })
})

test("حفظ المنتج المرتبط دون تغيير لا ينشئ نسخة إضافية", async () => {
  const id = randomUUID()
  const result = await syncStorePaymentProduct({
    name: "neon ora", price: "1.00", existingId: id, previousName: "neon ora", previousPrice: "1.00",
  }, async () => { throw new Error("Unexpected gateway call") })
  assert.deepEqual(result, { id, created: false })
})

test("تغيير الاسم فقط يعيد استخدام منتج الدفع", async () => {
  const id = randomUUID()
  const result = await syncStorePaymentProduct({
    name: "New name", price: "1.00", existingId: id, previousName: "Old name", previousPrice: "1.00",
  }, async (path, init) => {
    assert.equal(path, `/products/${id}`)
    assert.equal(init.method, "PATCH")
    assert.deepEqual(JSON.parse(String(init.body)), { name: "New name" })
    return { id, name: "New name", price: "1.00", currency: "SAR" }
  })
  assert.equal(result.created, false)
})

test("تغيير السعر لا يغير منتج الطلبات السابقة", async () => {
  const previousId = randomUUID(), nextId = randomUUID()
  const result = await syncStorePaymentProduct({
    name: "neon ora", price: "2.00", existingId: previousId, previousName: "neon ora", previousPrice: "1.00",
  }, async (path, init) => {
    assert.equal(path, "/products")
    assert.equal(init.method, "POST")
    return { id: nextId, name: "neon ora", price: "2.00", currency: "SAR" }
  })
  assert.equal(result.id, nextId)
  assert.equal(result.created, true)
})

test("رفض السعر أو العملة أو المعرّف غير المطابق", async () => {
  for (const remote of [
    { id: randomUUID(), name: "neon ora", price: "0.00", currency: "SAR" },
    { id: randomUUID(), name: "neon ora", price: "1.00", currency: "USD" },
    { id: "invalid", name: "neon ora", price: "1.00", currency: "SAR" },
  ]) {
    await assert.rejects(syncStorePaymentProduct({ name: "neon ora", price: "1.00" }, async () => remote), StorePaymentError)
  }
})

test("فشل البوابة يرجع خطأ آمناً دون كشف أسرار", async () => {
  await assert.rejects(syncStorePaymentProduct({ name: "neon ora", price: "1.00" }, async () => {
    throw new Error("Private gateway details")
  }), (error: unknown) => error instanceof StorePaymentError && error.message === "STREAM_PRODUCT_SYNC_FAILED")
})
