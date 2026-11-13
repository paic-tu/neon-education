import { z } from "zod"

export const eventProductFields = {
  productType: z.enum(["physical", "event_ticket"]).default("physical"),
  eventStartsAt: z.string().datetime({ offset: true }).nullable().optional(),
  eventEndsAt: z.string().datetime({ offset: true }).nullable().optional(),
  eventLocation: z.string().trim().max(500).nullable().optional(),
}

export function validEventWindow(data: {
  productType: string
  eventStartsAt?: string | Date | null
  eventEndsAt?: string | Date | null
  eventLocation?: string | null
}) {
  if (data.productType !== "event_ticket") return true
  return Boolean(data.eventStartsAt && data.eventEndsAt && data.eventLocation?.trim()
    && new Date(data.eventStartsAt).getTime() < new Date(data.eventEndsAt).getTime())
}
