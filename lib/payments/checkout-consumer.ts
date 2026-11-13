import { z } from "zod"
import {
  createStreamConsumer, findStreamConsumerByEmail, findStreamConsumerByPhone,
  normalizeSaudiPhone, streamRequest, StreamApiError,
} from "@/lib/payments/stream"

interface CheckoutConsumerInput {
  userId: string
  storedId?: string | null
  name: string
  email: string
  phone: string
  preferredLanguage: string
}

const defaultDependencies = {
  get: (id: string) => streamRequest<any>(`/consumers/${id}`, { method: "GET" }),
  create: createStreamConsumer,
  findByPhone: findStreamConsumerByPhone,
  findByEmail: findStreamConsumerByEmail,
}

export function isMissingStreamConsumer(error: unknown, consumerId: string, consumerRequest = false) {
  if (!(error instanceof StreamApiError)) return false
  if (consumerRequest && error.status === 404) return true
  const details = String(error.payload?.error?.additional_info || error.payload?.additional_info || "")
  return details.toLowerCase().includes(`organization consumer ${consumerId} was not found`.toLowerCase())
    || error.payload?.error?.code === "CONSUMER_NOT_FOUND"
}

function belongsToUser(consumer: any, input: CheckoutConsumerInput) {
  const externalId = String(consumer?.external_id || "").trim()
  if (externalId) return externalId === `neon_user_${input.userId}`
  const email = String(consumer?.email || "").trim().toLowerCase()
  const phone = normalizeSaudiPhone(String(consumer?.phone_number || ""))
  if (email && input.email && email !== input.email.trim().toLowerCase()) return false
  if (phone && input.phone && phone !== input.phone) return false
  return Boolean(
    (input.email && email === input.email.trim().toLowerCase())
    || (input.phone && phone === input.phone),
  )
}

export async function ensureCheckoutConsumer(input: CheckoutConsumerInput, dependencies = defaultDependencies) {
  if (input.storedId && z.string().uuid().safeParse(input.storedId).success) {
    try {
      const response = await dependencies.get(input.storedId)
      const consumer = response?.data || response
      if (consumer?.id === input.storedId && belongsToUser(consumer, input)) return input.storedId
      if (!consumer?.id) throw new Error("تعذر التحقق من عميل الدفع")
    } catch (error) {
      // لا نستبدل العميل عند انقطاع الخدمة أو فشل صلاحيات المفاتيح.
      if (!isMissingStreamConsumer(error, input.storedId, true)) throw error
    }
  }

  try {
    const created = await dependencies.create({
      name: input.name, phone_number: input.phone || undefined, email: input.email || undefined,
      external_id: `neon_user_${input.userId}`, communication_methods: input.phone ? ["WHATSAPP"] : ["EMAIL"],
      preferred_language: input.preferredLanguage || undefined, alias: input.name,
      comment: "Created via Store Checkout",
    })
    return z.string().uuid().parse(created.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    const duplicate = message.includes("DUPLICATE_CONSUMER") || message.includes("Consumer already exist")
      || message.includes("PHONE_ALREADY_REGISTERED")
    if (!duplicate) throw error
    const candidates = [
      input.phone ? await dependencies.findByPhone(input.phone) : null,
      input.email ? await dependencies.findByEmail(input.email) : null,
    ]
    const existing = candidates.find((candidate) => candidate && belongsToUser(candidate, input)
      && z.string().uuid().safeParse(candidate.id).success)
    if (existing) return String(existing.id)
    const phoneOwner = candidates[0]
    // الرقم المشترك لا يبرر ربط الحساب بعميل شخص آخر؛ نستخدم بريده كقناة مستقلة.
    if (input.phone && z.string().email().safeParse(input.email).success
      && phoneOwner && !belongsToUser(phoneOwner, input) && !candidates[1]) {
      return ensureCheckoutConsumer({ ...input, storedId: null, phone: "" }, dependencies)
    }
    throw new Error("تعذر ربط بياناتك بعميل الدفع. يرجى مراجعة البريد ورقم الجوال أو التواصل مع الدعم.")
  }
}

export async function withConsumerRecovery<T>(consumerId: string, createLink: (id: string) => Promise<T>, recover: () => Promise<string>) {
  try {
    return await createLink(consumerId)
  } catch (error) {
    // استعادة واحدة فقط إذا حذف العميل بين التحقق منه وإنشاء الرابط، دون إعادة طلب مبهم.
    if (!isMissingStreamConsumer(error, consumerId)) throw error
    const repairedId = await recover()
    return createLink(repairedId)
  }
}
