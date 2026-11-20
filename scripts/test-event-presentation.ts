import { test } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { eventDescriptionSections, eventSchedule } from "../lib/event-presentation"
import { EventCatalogCard, type EventCatalogItem } from "../components/event-catalog-card"

const item: EventCatalogItem = {
  id: "event", nameAr: "Neon Era", nameEn: "Neon Era", price: "69.00",
  descriptionAr: "FULL_DESCRIPTION_ONLY_IN_DETAILS", descriptionEn: "FULL_DESCRIPTION_ONLY_IN_DETAILS",
  stockQuantity: 160, availableQuantity: 160, eventLocation: "Taif",
  eventStartsAt: "2026-12-05T12:30:00Z", eventEndsAt: "2026-12-05T19:30:00Z",
}

test("بطاقة الفعالية مختصرة ولا تعرض الوصف الكامل", () => {
  for (const isAr of [true, false]) {
    const html = renderToStaticMarkup(createElement(EventCatalogCard, {
      item, isAr, busy: false, adding: false, onDetails: () => {}, onBook: () => {},
    }))
    assert(!html.includes("FULL_DESCRIPTION_ONLY_IN_DETAILS"))
    assert(html.includes("69.00"))
    assert(html.includes(isAr ? "٢٠٢٦" : "2026"))
    assert(html.includes(isAr ? "تفاصيل الفعالية" : "Event details"))
    assert(html.includes(isAr ? "احجز الآن" : "Book now"))
  }
})

test("التاريخ ميلادي والوقت في الرياض ويشمل فترة الدخول كاملة", () => {
  const english = eventSchedule(item.eventStartsAt, item.eventEndsAt, false)
  assert(english.date.includes("2026"))
  assert(english.date.includes("December"))
  assert(english.time.includes("3:30") && english.time.includes("10:30"))
  assert(eventSchedule(item.eventStartsAt, item.eventEndsAt, true).date.includes("٢٠٢٦"))
  assert.deepEqual(eventSchedule("invalid", null, true), { date: "", time: "" })
})

test("تقسيم الوصف يحافظ على البرنامج وشروط الحجز دون إدراج HTML", () => {
  const source = "Introduction\r\nFull program\r\n━━━━━━━━━━━━━━━\r\nTerms\r\n* Non-refundable\r\n<script>plain text</script>"
  const sections = eventDescriptionSections(source)
  assert.deepEqual(sections, [
    ["Introduction", "Full program"], ["Terms", "* Non-refundable", "<script>plain text</script>"],
  ])
  assert.deepEqual(eventDescriptionSections(null), [])
})

test("التفاصيل تبقى متاحة بعد نفاد التذاكر لكن الحجز يتعطل", () => {
  const html = renderToStaticMarkup(createElement(EventCatalogCard, {
    item: { ...item, availableQuantity: 0 }, isAr: false, busy: false, adding: false, onDetails: () => {}, onBook: () => {},
  }))
  assert(html.includes("Event details"))
  assert(html.includes("Sold out"))
  assert(html.includes("disabled"))
})
