import { test } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AdmissionTicketOptions } from "../components/admission-ticket-options"

const options = [
  { id: "free", nameAr: "حضور", nameEn: "Attendance", price: "0.00", noteAr: "دخول الفعالية", noteEn: "Event entry" },
  { id: "meal", nameAr: "عشاء", nameEn: "Dinner", price: "30.00", noteAr: "وجبة واحدة\nدون مشروبات <script>", noteEn: "One meal\nNo drinks <script>" },
]

test("الموظف يرى الاختيارات المجانية والمدفوعة وملاحظاتها بالعربية والإنجليزية", () => {
  for (const isAr of [true, false]) {
    const html = renderToStaticMarkup(createElement(AdmissionTicketOptions, { options, isAr }))
    assert(html.includes(isAr ? "حضور" : "Attendance"))
    assert(html.includes(isAr ? "عشاء" : "Dinner"))
    assert(html.includes(isAr ? "دون مشروبات" : "No drinks"))
    assert(!html.includes("<script>"))
    assert(html.includes("&lt;script&gt;"))
    assert(!html.includes("<details"))
  }
})

test("السجل يعرض الأسماء والتفاصيل القابلة للتوسيع دون تغيير الاختيارات", () => {
  const html = renderToStaticMarkup(createElement(AdmissionTicketOptions, { options, isAr: true, compact: true }))
  assert.equal((html.match(/<details/g) ?? []).length, 2)
  assert(!html.includes("<details open"))
  assert(html.includes("حضور") && html.includes("عشاء"))
})

test("تمييز التذكرة بدون إضافات عن التفاصيل التي لم تصل", () => {
  const empty = renderToStaticMarkup(createElement(AdmissionTicketOptions, { options: [], isAr: true }))
  const unavailable = renderToStaticMarkup(createElement(AdmissionTicketOptions, { isAr: true }))
  assert(empty.includes("لم يختر المشتري إضافات"))
  assert(unavailable.includes("لم تتوفر تفاصيل الخيارات"))
  assert(!unavailable.includes("لم يختر المشتري إضافات"))
})

test("الملاحظة تستخدم اللغة البديلة عندما لا تتوفر لغة الموظف", () => {
  const html = renderToStaticMarkup(createElement(AdmissionTicketOptions, {
    options: [{ id: "meal", nameAr: "عشاء", nameEn: "Dinner", price: "30.00", noteEn: "Dinner for one" }],
    isAr: true,
  }))
  assert(html.includes("Dinner for one"))
})
