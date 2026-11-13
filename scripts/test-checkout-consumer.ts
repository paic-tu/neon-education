import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { ensureCheckoutConsumer, withConsumerRecovery } from "../lib/payments/checkout-consumer"
import { StreamApiError, findStreamConsumerByEmail, findStreamConsumerByPhone } from "../lib/payments/stream"

const userId = randomUUID(), oldId = randomUUID(), newId = randomUUID()
const input = { userId, storedId: oldId, name: "Buyer", email: "buyer@example.test", phone: "+966500000001", preferredLanguage: "ar" }
const missing = () => new StreamApiError("STREAM_ERROR", 500, {
  error: { code: "STREAM_ERROR", additional_info: `Organization consumer ${oldId} was not found` },
})
const dependencies = () => ({
  get: async (_id: string): Promise<any> => { throw missing() },
  create: async (_data: any) => ({ id: newId, name: "Buyer" }),
  findByPhone: async (_phone: string): Promise<any> => null,
  findByEmail: async (_email: string): Promise<any> => null,
})

test("المعرّف المحفوظ الصالح لا ينشئ عميلاً جديداً", async () => {
  const deps = dependencies()
  deps.get = async () => ({ id: oldId, external_id: `neon_user_${userId}` })
  deps.create = async () => { throw new Error("يجب عدم الإنشاء") }
  assert.equal(await ensureCheckoutConsumer(input, deps), oldId)
})

test("استعادة العميل المحذوف عند خطأ البوابة الظاهر أو 404", async () => {
  for (const error of [missing(), new StreamApiError("Not found", 404, {})]) {
    const deps = dependencies()
    deps.get = async () => { throw error }
    assert.equal(await ensureCheckoutConsumer(input, deps), newId)
  }
})

test("فشل المفاتيح أو الخدمة لا ينشئ عميلاً بديلاً", async () => {
  for (const status of [401, 403, 500, 503]) {
    const deps = dependencies()
    const error = new StreamApiError("Unavailable", status, {})
    deps.get = async () => { throw error }
    deps.create = async () => { throw new Error("يجب عدم الإنشاء") }
    await assert.rejects(ensureCheckoutConsumer(input, deps), (caught) => caught === error)
  }
})

test("العميل المتكرر يتطلب بيانات مطابقة ولا يقبل حساب شخص آخر", async () => {
  const deps = dependencies()
  deps.create = async () => { throw new Error("DUPLICATE_CONSUMER") }
  deps.findByPhone = async () => ({ id: randomUUID(), phone_number: input.phone, external_id: "neon_user_other" })
  deps.findByEmail = async () => ({ id: newId, email: input.email })
  assert.equal(await ensureCheckoutConsumer(input, deps), newId)
  deps.findByEmail = async () => ({ id: newId, email: "other@example.test" })
  await assert.rejects(ensureCheckoutConsumer(input, deps))
})

test("المعرّف المحفوظ لشخص آخر لا يُستخدم", async () => {
  const deps = dependencies()
  deps.get = async () => ({ id: oldId, external_id: "neon_user_other", email: input.email })
  assert.equal(await ensureCheckoutConsumer(input, deps), newId)
})

test("رقم الجوال المرتبط بحساب آخر يستخدم عميلاً مستقلاً بالبريد", async () => {
  const deps = dependencies()
  const attempts: any[] = []
  deps.create = async (data) => {
    attempts.push(data)
    if (data.phone_number) throw new Error("PHONE_ALREADY_REGISTERED")
    return { id: newId, name: "Buyer" }
  }
  deps.findByPhone = async () => ({ id: oldId, phone_number: input.phone, external_id: "neon_user_other", email: "other@example.test" })
  assert.equal(await ensureCheckoutConsumer({ ...input, storedId: null }, deps), newId)
  assert.equal(attempts.length, 2)
  assert.equal(attempts[1].phone_number, undefined)
  assert.equal(attempts[1].email, input.email)
  assert.equal(attempts[1].external_id, `neon_user_${userId}`)
  assert.deepEqual(attempts[1].communication_methods, ["EMAIL"])
})

test("تعارض البريد لا يربط حساباً آخر ولا يعيد الإنشاء بلا نهاية", async () => {
  const deps = dependencies()
  let attempts = 0
  deps.create = async () => { attempts++; throw new Error("DUPLICATE_CONSUMER") }
  deps.findByPhone = async () => ({ id: oldId, phone_number: input.phone, external_id: "neon_user_other" })
  await assert.rejects(ensureCheckoutConsumer({ ...input, storedId: null }, deps))
  assert.equal(attempts, 2)
  attempts = 0
  deps.findByEmail = async () => ({ id: oldId, email: input.email, external_id: "neon_user_other" })
  await assert.rejects(ensureCheckoutConsumer({ ...input, storedId: null }, deps))
  assert.equal(attempts, 1)
})

test("مطابقة رقم الجوال وحده لا تتجاوز تعارض البريد", async () => {
  const deps = dependencies()
  deps.get = async () => ({ id: oldId, phone_number: input.phone, email: "other@example.test" })
  assert.equal(await ensureCheckoutConsumer(input, deps), newId)
})

test("حذف العميل أثناء تجهيز الرابط يُصلح باستعادة واحدة", async () => {
  const attempted: string[] = []
  let recovered = 0
  const result = await withConsumerRecovery(oldId, async (id) => {
    attempted.push(id)
    if (id === oldId) throw missing()
    return { id: "payment-link" }
  }, async () => { recovered++; return newId })
  assert.equal(result.id, "payment-link")
  assert.deepEqual(attempted, [oldId, newId])
  assert.equal(recovered, 1)
})

test("لا يُعاد طلب الدفع عند خطأ المنتج أو نتيجة اتصال مبهمة", async () => {
  for (const error of [new Error("Timeout"), new StreamApiError("Product not found", 404, {})]) {
    let attempts = 0
    await assert.rejects(withConsumerRecovery(oldId, async () => { attempts++; throw error }, async () => {
      throw new Error("يجب عدم الاستعادة")
    }), (caught) => caught === error)
    assert.equal(attempts, 1)
  }
})

test("البحث لا يرجع أول نتيجة غير مطابقة", async () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.STREAM_API_KEY_BASE64
  process.env.STREAM_API_KEY_BASE64 = "test-only-not-a-real-key"
  globalThis.fetch = async () => new Response(JSON.stringify([{ id: newId, email: "other@example.test", phone_number: "+966500000099" }]), { status: 200 })
  try {
    assert.equal(await findStreamConsumerByEmail(input.email), null)
    assert.equal(await findStreamConsumerByPhone(input.phone), null)
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.STREAM_API_KEY_BASE64
    else process.env.STREAM_API_KEY_BASE64 = originalKey
  }
})
