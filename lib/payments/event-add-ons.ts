import type { EventAddOn, EventAddOnInput } from "@/lib/event-add-ons"
import { syncStorePaymentProduct } from "./store-product"

export async function syncEventAddOnProducts(
  input: EventAddOnInput[], previous: EventAddOn[], createdIds: string[],
  sync: typeof syncStorePaymentProduct = syncStorePaymentProduct,
) {
  const result: EventAddOn[] = []
  for (const option of input) {
    const price = option.price.toFixed(2)
    const old = previous.find((item) => item.id === option.id)
    let streamProductId: string | null = null
    if (option.price > 0) {
      const remote = await sync({
        name: option.nameEn, price, existingId: old?.streamProductId,
        previousName: old?.nameEn, previousPrice: old?.price,
      })
      streamProductId = remote.id
      if (remote.created) createdIds.push(remote.id)
    }
    result.push({ id: option.id, nameAr: option.nameAr, nameEn: option.nameEn, price, streamProductId,
      ...(option.noteAr ? { noteAr: option.noteAr } : {}), ...(option.noteEn ? { noteEn: option.noteEn } : {}),
    })
  }
  return result
}
