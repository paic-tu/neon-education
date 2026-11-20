import { test } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CartEventOptions } from "../components/cart-event-options"

const options = [
  { id: "basic", nameAr: "حضور", nameEn: "Attendance", price: "0.00", streamProductId: null, noteAr: "تفاصيل الحضور", noteEn: "Attendance details" },
  { id: "dinner", nameAr: "عشاء", nameEn: "Dinner", price: "30.00", streamProductId: "paid", noteAr: "<script>ملاحظة</script>", noteEn: "<script>note</script>" },
]
const render = (overrides = {}) => renderToStaticMarkup(createElement(CartEventOptions, {
  itemId: "cart", options, selectedIds: ["basic", "dinner"], quantity: 2,
  isAr: true, disabled: false, saving: false, onChange: () => {}, ...overrides,
}))

test("الاختيارات المتعددة واضحة والتفاصيل مغلقة افتراضيا", () => {
  const html = render()
  assert.equal((html.match(/aria-checked="true"/g) ?? []).length, 2)
  assert.equal((html.match(/<details/g) ?? []).length, 2)
  assert(!html.includes("<details open"))
  assert(html.includes("بدون تكلفة إضافية"))
  assert(html.includes("الإضافات لكل تذكرة:"))
  assert(html.includes("30.00"))
  assert(html.includes("التذاكر (2)"))
  assert(html.includes("&lt;script&gt;"))
  assert(!html.includes("<script>"))
})

test("تعطيل الخيارات أثناء الحفظ مع إبقاء الحذف للإضافة غير المتاحة", () => {
  const html = render({ selectedIds: ["missing"], disabled: true, saving: true })
  assert(html.includes("aria-busy=\"true\""))
  assert(html.includes("disabled"))
  assert(html.includes("role=\"status\""))
  assert(html.includes("role=\"alert\""))
  assert(html.includes("لم تعد متاحة"))
})

test("دعم الإنجليزية والملاحظات البديلة دون تغيير الأسعار", () => {
  const html = render({ isAr: false, selectedIds: [] })
  assert(html.includes("Enhance your experience"))
  assert(html.includes("No extra charge"))
  assert(html.includes("Attendance details"))
  assert(html.includes("0.00 SAR"))
  assert.equal((html.match(/aria-checked="false"/g) ?? []).length, 2)
})
