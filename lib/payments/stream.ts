import crypto from "crypto"

const STREAM_API_BASE = "https://stream-app-service.streampay.sa/api/v2"

export class StreamApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly payload: any) {
    super(message)
    this.name = "StreamApiError"
  }
}

function getStreamApiKeyBase64() {
  const base64 = process.env.STREAM_API_KEY_BASE64
  if (base64 && base64.trim()) return base64.trim()

  const apiKey = process.env.STREAM_API_KEY
  const apiSecret = process.env.STREAM_API_SECRET
  if (apiKey && apiSecret) {
    const raw = `${apiKey}:${apiSecret}`
    return Buffer.from(raw, "utf8").toString("base64")
  }

  throw new Error("Stream API credentials are not set (set STREAM_API_KEY_BASE64 or STREAM_API_KEY + STREAM_API_SECRET)")
}

function getOptionalBranchId() {
  return process.env.STREAM_BRANCH_ID || null
}

export function getAppBaseUrl() {
  const url = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL
  if (!url) return "https://neonedu.org"
  return url.replace(/\/+$/, "")
}

export async function streamRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${STREAM_API_BASE}${path.startsWith("/") ? path : `/${path}`}`
  const headers = new Headers(init.headers)
  headers.set("x-api-key", getStreamApiKeyBase64())
  headers.set("Content-Type", "application/json")

  const branchId = getOptionalBranchId()
  if (branchId) headers.set("x-branch-id", branchId)

  const res = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  })

  const text = await res.text()
  let body: any = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!res.ok) {
    const baseMsg = body?.error?.message || body?.message || `Stream API error (${res.status})`
    const detailsRaw = body ? JSON.stringify(body) : text
    const details = detailsRaw && detailsRaw.length > 800 ? `${detailsRaw.slice(0, 800)}…` : detailsRaw
    throw new StreamApiError(details ? `${baseMsg} — ${details}` : baseMsg, res.status, body)
  }

  return body as T
}

export async function createStreamPaymentLink(input: {
  name: string
  amount?: number
  currency?: string
  maxNumberOfPayments?: number | null
  organizationConsumerId?: string | null
  description?: string | null
  contactInformationType?: "PHONE" | "EMAIL" | null
  items?: Array<{ productId: string; quantity: number }>
  couponIds?: string[] | null
  successRedirectUrl: string
  failureRedirectUrl: string
  customMetadata?: Record<string, any>
}) {
  const payload: any = {
    name: input.name,
    currency: input.currency || "SAR",
    max_number_of_payments: typeof input.maxNumberOfPayments === "number" ? input.maxNumberOfPayments : input.maxNumberOfPayments === null ? null : 1,
    organization_consumer_id: input.organizationConsumerId || undefined,
    description: input.description ?? undefined,
    contact_information_type: input.contactInformationType ?? undefined,
    success_redirect_url: input.successRedirectUrl,
    failure_redirect_url: input.failureRedirectUrl,
    custom_metadata: input.customMetadata || {},
  }

  if (Array.isArray(input.couponIds) && input.couponIds.length > 0) {
    payload.coupons = input.couponIds
  }

  if (Array.isArray(input.items) && input.items.length > 0) {
    payload.items = input.items.map((it) => ({
      product_id: it.productId,
      quantity: it.quantity,
    }))
  } else if (typeof input.amount === "number") {
    payload.amount = input.amount
  }

  return await streamRequest<{
    id: string
    url: string
    status?: string
    amount?: string
    original_amount?: string
    item_level_discounted_amount?: string
    currency?: string
  }>(
    "/payment_links",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  )
}

export function normalizeSaudiPhone(phone: string) {
  const raw = String(phone || "").trim()
  if (!raw) return ""
  if (raw.startsWith("+")) return raw
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10 && digits.startsWith("05")) {
    return `+966${digits.slice(1)}`
  }
  if (digits.length === 9 && digits.startsWith("5")) {
    return `+966${digits}`
  }
  return raw
}

export async function createStreamConsumer(input: {
  name: string
  phone_number?: string
  email?: string
  external_id?: string
  communication_methods?: Array<"WHATSAPP" | "EMAIL" | "SMS">
  preferred_language?: string
  iban?: string
  alias?: string
  comment?: string
}) {
  const payload: any = {
    name: input.name,
    phone_number: input.phone_number || undefined,
    email: input.email || undefined,
    external_id: input.external_id || undefined,
    communication_methods: input.communication_methods || undefined,
    preferred_language: input.preferred_language || undefined,
    iban: input.iban || undefined,
    alias: input.alias || undefined,
    comment: input.comment || undefined,
  }

  return await streamRequest<{ id: string; name: string; phone_number?: string; email?: string }>(`/consumers`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

function normalizeListPayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

export async function findStreamConsumerByPhone(phoneE164: string) {
  const phone = String(phoneE164 || "").trim()
  if (!phone) return null

  const candidates: any[] = []
  try {
    const res = await streamRequest<any>(`/consumers?phone_number=${encodeURIComponent(phone)}`, { method: "GET" })
    candidates.push(...normalizeListPayload(res))
  } catch {}

  if (candidates.length === 0) {
    try {
      const res = await streamRequest<any>(`/consumers?search=${encodeURIComponent(phone)}`, { method: "GET" })
      candidates.push(...normalizeListPayload(res))
    } catch {}
  }

  const exact = candidates.find((c) => String(c?.phone_number || "").trim() === phone)
  return exact || null
}

export async function findStreamConsumerByEmail(email: string) {
  const e = String(email || "").trim().toLowerCase()
  if (!e) return null

  const candidates: any[] = []
  try {
    const res = await streamRequest<any>(`/consumers?search=${encodeURIComponent(e)}`, { method: "GET" })
    candidates.push(...normalizeListPayload(res))
  } catch {}

  const exact = candidates.find((c) => String(c?.email || "").trim().toLowerCase() === e)
  return exact || null
}

export function verifyStreamWebhookSignature(input: {
  secret: string
  rawBody: string
  signatureHeader: string | null
  nowMs?: number
  toleranceMs?: number
}) {
  if (!input.signatureHeader) return false
  const parts = input.signatureHeader.split(",").map((p) => p.trim())
  const kv: Record<string, string> = {}
  for (const part of parts) {
    const [k, v] = part.split("=")
    if (k && v) kv[k] = v
  }
  const timestamp = kv.t
  const signature = kv.v1
  if (!timestamp || !signature) return false

  const ts = Number.parseInt(timestamp, 10)
  if (!Number.isFinite(ts)) return false
  const nowMs = typeof input.nowMs === "number" ? input.nowMs : Date.now()
  const toleranceMs = typeof input.toleranceMs === "number" ? input.toleranceMs : 5 * 60_000
  const diff = Math.abs(nowMs - ts * 1000)
  if (diff > toleranceMs) return false

  const msg = `${timestamp}.${input.rawBody}`
  const computed = crypto.createHmac("sha256", input.secret).update(msg).digest("hex")

  const a = Buffer.from(computed, "hex")
  const b = Buffer.from(signature, "hex")
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Uint8Array.from(a), Uint8Array.from(b))
}
