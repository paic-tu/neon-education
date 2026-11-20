import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { storeItemFormSchema, formValidationMessages } from "../lib/store-item-form-validation"
import { snapshotEventAddOns, eventAddOnInputsSchema } from "../lib/event-add-ons"

const valid = {
  nameAr: "فعالية نيون", nameEn: "Neon Event", descriptionAr: "تفاصيل الفعالية للمشترين",
  descriptionEn: "Details for ticket buyers", price: 1, stock: 20, categoryId: randomUUID(),
  productType: "event_ticket", eventStartsAt: "2026-12-01T18:00", eventEndsAt: "2026-12-01T23:00",
  eventLocation: "Hall", eventAddOns: [],
}

test("النموذج الصالح يمر للحفظ والنواقص لها أخطاء واضحة", () => {
  assert(storeItemFormSchema(true).safeParse(valid).success)
  const result = storeItemFormSchema(true).safeParse({ ...valid, nameAr: "", descriptionEn: "", categoryId: "" })
  assert(!result.success)
  assert(result.error.issues.some((issue) => issue.path[0] === "descriptionEn" && issue.message.includes("10")))
  assert(result.error.issues.some((issue) => issue.path[0] === "nameAr" && issue.message.includes("بالعربية")))
})

test("الوقت والموقع يتحقق منهما النموذج حتى بدون تحقق المتصفح", () => {
  for (const input of [
    { ...valid, eventStartsAt: "", eventLocation: "" },
    { ...valid, eventStartsAt: "not a date" },
    { ...valid, eventEndsAt: valid.eventStartsAt },
  ]) assert(!storeItemFormSchema(true).safeParse(input).success)
  assert(storeItemFormSchema(false).safeParse({ ...valid, productType: "physical", eventStartsAt: "", eventEndsAt: "", eventLocation: "" }).success)
})

test("تجميع أخطاء الإضافات المتداخلة يتجاهل مراجع حقول المتصفح", () => {
  const ref: any = {}
  ref.parent = ref
  assert.deepEqual(formValidationMessages({
    descriptionAr: { message: "الوصف مطلوب", ref },
    eventAddOns: [{ nameAr: { message: "اسم الإضافة مطلوب", ref } }],
  }), [
    { path: "descriptionAr", message: "الوصف مطلوب" },
    { path: "eventAddOns.0.nameAr", message: "اسم الإضافة مطلوب" },
  ])
})

test("ملاحظة الإضافة اختيارية وتُحفظ نسخة مستقلة دون تغيير التذاكر القديمة", () => {
  const option = eventAddOnInputsSchema.parse([{
    id: randomUUID(), nameAr: "عشاء", nameEn: "Dinner", price: 25, noteAr: " تشمل عشاء لشخص واحد فقط ",
  }])[0]
  const stored = { ...option, price: "25.00", streamProductId: randomUUID() }
  const snapshot = snapshotEventAddOns([stored])
  assert.equal(snapshot[0].noteAr, "تشمل عشاء لشخص واحد فقط")
  stored.noteAr = "ملاحظة جديدة"
  assert.equal(snapshot[0].noteAr, "تشمل عشاء لشخص واحد فقط")
  const legacy = { id: randomUUID(), nameAr: "عشاء", nameEn: "Dinner", price: "25.00", streamProductId: null }
  assert(!("noteAr" in snapshotEventAddOns([legacy])[0]))
  assert(!eventAddOnInputsSchema.safeParse([{ ...option, noteAr: "a".repeat(501) }]).success)
})
