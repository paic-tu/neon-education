import { z } from "zod"
import { eventAddOnInputsSchema } from "./event-add-ons"

export function storeItemFormSchema(isAr: boolean) {
  const text = (ar: string, en: string) => isAr ? ar : en
  return z.object({
    nameEn: z.string().trim().min(1, text("أدخل اسم المنتج بالإنجليزية", "Enter the English product name")),
    nameAr: z.string().trim().min(1, text("أدخل اسم المنتج بالعربية", "Enter the Arabic product name")),
    descriptionEn: z.string().trim().min(10, text("الوصف بالإنجليزية يجب أن يكون 10 أحرف على الأقل", "English description must contain at least 10 characters")),
    descriptionAr: z.string().trim().min(10, text("الوصف بالعربية يجب أن يكون 10 أحرف على الأقل", "Arabic description must contain at least 10 characters")),
    price: z.number({ invalid_type_error: text("أدخل سعرًا صحيحًا", "Enter a valid price") }).finite().min(0).max(99999999.99),
    pointsCost: z.number().int().min(0).optional().nullable(),
    stock: z.number({ invalid_type_error: text("أدخل سعة أو مخزونًا صحيحًا", "Enter a valid capacity or stock") }).int().min(0),
    categoryId: z.string().uuid(text("اختر تصنيفًا صالحًا للمنتج", "Select a valid product category")),
    imageUrl: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
    productType: z.enum(["physical", "event_ticket"]).default("physical"),
    eventStartsAt: z.string().optional(),
    eventEndsAt: z.string().optional(),
    eventLocation: z.string().max(500).optional(),
    eventAddOns: eventAddOnInputsSchema.default([]),
  }).superRefine((data, context) => {
    if (data.productType !== "event_ticket") return
    if (!data.eventLocation?.trim()) context.addIssue({
      code: z.ZodIssueCode.custom, path: ["eventLocation"], message: text("أدخل موقع الفعالية", "Enter the event location"),
    })
    const start = data.eventStartsAt ? new Date(data.eventStartsAt).getTime() : NaN
    const end = data.eventEndsAt ? new Date(data.eventEndsAt).getTime() : NaN
    if (!Number.isFinite(start)) context.addIssue({
      code: z.ZodIssueCode.custom, path: ["eventStartsAt"], message: text("حدد بداية الدخول", "Select the admission opening time"),
    })
    if (!Number.isFinite(end)) context.addIssue({
      code: z.ZodIssueCode.custom, path: ["eventEndsAt"], message: text("حدد نهاية الدخول", "Select the admission closing time"),
    })
    if (Number.isFinite(start) && Number.isFinite(end) && start >= end) context.addIssue({
      code: z.ZodIssueCode.custom, path: ["eventEndsAt"],
      message: text("نهاية الدخول يجب أن تكون بعد بدايته", "Admission must close after it opens"),
    })
  })
}

export function formValidationMessages(errors: unknown, prefix = ""): { path: string; message: string }[] {
  if (!errors || typeof errors !== "object") return []
  const node = errors as Record<string, unknown>
  const own = typeof node.message === "string" ? [{ path: prefix, message: node.message }] : []
  return own.concat(Object.entries(node).flatMap(([key, value]) =>
    ["ref", "message", "type", "types"].includes(key) ? [] : formValidationMessages(value, prefix ? `${prefix}.${key}` : key)))
}
