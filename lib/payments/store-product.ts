import { z } from "zod"
import { streamRequest } from "@/lib/payments/stream"

const remoteProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  price: z.union([z.string(), z.number()]),
  currency: z.literal("SAR"),
})

type RequestProduct = (path: string, init: RequestInit) => Promise<unknown>

export class StorePaymentError extends Error {
  readonly status = 502
  constructor() {
    super("STREAM_PRODUCT_SYNC_FAILED")
  }
}

export async function syncStorePaymentProduct(input: {
  name: string
  price: string
  existingId?: string | null
  previousName?: string
  previousPrice?: string
}, request: RequestProduct = streamRequest) {
  const unchangedPrice = Number(input.price) === Number(input.previousPrice)
  if (input.existingId && unchangedPrice && input.name === input.previousName) {
    return { id: input.existingId, created: false }
  }

  // السعر الجديد يحصل على منتج مستقل، حتى لا تتغير روابط الدفع للطلبات القديمة.
  const reuse = Boolean(input.existingId && unchangedPrice)
  try {
    const remote = await request(reuse ? `/products/${input.existingId}` : "/products", {
      method: reuse ? "PATCH" : "POST",
      body: JSON.stringify(reuse
        ? { name: input.name }
        : { name: input.name, type: "ONE_OFF", currency: "SAR", price: input.price }),
    })
    const parsed = remoteProductSchema.safeParse(remote)
    if (!parsed.success || parsed.data.name !== input.name || Number(parsed.data.price) !== Number(input.price)
      || (reuse && parsed.data.id !== input.existingId)) {
      throw new StorePaymentError()
    }
    return { id: parsed.data.id, created: !reuse }
  } catch {
    throw new StorePaymentError()
  }
}

export async function discardNewStorePaymentProduct(id: string) {
  try {
    await streamRequest(`/products/${id}`, { method: "DELETE" })
  } catch {
    console.error("Unable to clean up newly created Stream product", id)
  }
}
