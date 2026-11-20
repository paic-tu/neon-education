export function eventSchedule(start: Date | string | null | undefined, end: Date | string | null | undefined, isAr: boolean) {
  const first = start ? new Date(start) : null
  const last = end ? new Date(end) : null
  const locale = isAr ? "ar-SA-u-ca-gregory" : "en-GB"
  const zone = { timeZone: "Asia/Riyadh" }
  const valid = (date: Date | null): date is Date => !!date && Number.isFinite(date.getTime())
  const date = valid(first) ? first.toLocaleDateString(locale, { ...zone, weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""
  const time = (value: Date) => value.toLocaleTimeString(locale, { ...zone, hour: "numeric", minute: "2-digit", hour12: true })
  return { date, time: valid(first) ? `${time(first)}${valid(last) ? ` - ${time(last)}` : ""}` : "" }
}

export function eventDescriptionSections(description: string | null | undefined) {
  return (description ?? "").replace(/\r\n?/g, "\n").split(/^\s*[━─=_-]{3,}\s*$/m)
    .map((section) => section.trim()).filter(Boolean).map((section) => section.split("\n").map((line) => line.trim()).filter(Boolean))
}
