import { z } from "zod"

export const eventAddOnInputSchema = z.object({
  id: z.string().uuid(),
  nameAr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  noteAr: z.string().trim().max(500).optional(),
  noteEn: z.string().trim().max(500).optional(),
  price: z.number().finite().min(0).max(999999.99)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, "Use at most two decimal places"),
})
export const eventAddOnInputsSchema = z.array(eventAddOnInputSchema).max(20)
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length, "Duplicate add-on")
export const eventAddOnIdsSchema = z.array(z.string().uuid()).max(20)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate add-on")

export type EventAddOnInput = z.infer<typeof eventAddOnInputSchema>
export type SelectedEventAddOn = { id: string; nameAr: string; nameEn: string; price: string; noteAr?: string; noteEn?: string }
export type EventAddOn = SelectedEventAddOn & { streamProductId: string | null }

export function moneyInHalalas(value: string | number) {
  const text = String(value)
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) throw new Error("Invalid price")
  const [whole, fraction = ""] = text.split(".")
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
}

export function resolveEventAddOns(available: EventAddOn[] | null | undefined, input: unknown) {
  const ids = eventAddOnIdsSchema.parse(input ?? []).sort()
  return ids.map((id) => {
    const option = (available ?? []).find((item) => item.id === id)
    if (!option) throw new Error("Event add-on is no longer available")
    moneyInHalalas(option.price)
    return { ...option }
  })
}

export function snapshotEventAddOns(options: EventAddOn[]): SelectedEventAddOn[] {
  return options.map(({ id, nameAr, nameEn, price, noteAr, noteEn }) => ({
    id, nameAr, nameEn, price, ...(noteAr ? { noteAr } : {}), ...(noteEn ? { noteEn } : {}),
  }))
}

export function eventItemUnitPrice(base: string, options: SelectedEventAddOn[]) {
  const halalas = options.reduce((sum, option) => sum + moneyInHalalas(option.price), moneyInHalalas(base))
  if (halalas > 9_999_999_999) throw new Error("Invalid total price")
  return (halalas / 100).toFixed(2)
}

export function checkoutItemKey(item: {
  courseId?: string | null; productId?: string | null; quantity: number; price: string; selectedAddOns?: SelectedEventAddOn[] | null
}) {
  const options = (item.selectedAddOns ?? []).map((option) => ({ ...option })).sort((a, b) => a.id.localeCompare(b.id))
  return JSON.stringify([item.courseId || item.productId, item.quantity, moneyInHalalas(item.price), options])
}
