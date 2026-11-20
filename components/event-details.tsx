"use client"

import Image from "next/image"
import { CalendarDays, Clock3, Loader2, MapPin, ShoppingCart, Ticket } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { eventDescriptionSections, eventSchedule } from "@/lib/event-presentation"
import type { EventCatalogItem } from "./event-catalog-card"

function DescriptionLines({ lines }: { lines: string[] }) {
  const blocks: { kind: "bullet" | "number" | "heading" | "text"; lines: string[] }[] = []
  lines.forEach((line, index) => {
    const kind = /^\*\s/.test(line) ? "bullet" : /^\d+\.\s/.test(line) ? "number"
      : /^[A-Z][A-Z\s]+[|｜]/.test(line) || (line.length < 60 && !/[.!؟:：]$/.test(line) && (lines[index + 1]?.length ?? 0) > 80) ? "heading" : "text"
    const last = blocks[blocks.length - 1]
    if ((kind === "bullet" || kind === "number") && last?.kind === kind) last.lines.push(line)
    else blocks.push({ kind, lines: [line] })
  })
  return <>{blocks.map((block, index) => {
    if (block.kind === "bullet" || block.kind === "number") {
      const entries = block.lines.map((line, lineIndex) => <li key={lineIndex}>{line.replace(/^(?:\*\s|\d+\.\s)/, "")}</li>)
      return block.kind === "bullet" ? <ul key={index} className="list-outside list-disc space-y-2 ps-5">{entries}</ul>
        : <ol key={index} start={Number.parseInt(block.lines[0], 10)} className="list-outside list-decimal space-y-2 ps-5">{entries}</ol>
    }
    return block.kind === "heading" ? <h4 key={index} className="pt-3 font-semibold text-foreground">{block.lines[0]}</h4>
      : <p key={index} className="whitespace-pre-wrap break-words">{block.lines[0]}</p>
  })}</>
}

export function EventDetails({ item, isAr, busy, adding, onClose, onBook, onCloseFocus }: {
  item: EventCatalogItem; isAr: boolean; busy: boolean; adding: boolean; onClose: () => void; onBook: () => void; onCloseFocus: () => void
}) {
  const name = isAr ? item.nameAr : item.nameEn
  const description = isAr ? item.descriptionAr || item.descriptionEn : item.descriptionEn || item.descriptionAr
  const sections = eventDescriptionSections(description)
  const schedule = eventSchedule(item.eventStartsAt, item.eventEndsAt, isAr)
  const available = item.availableQuantity ?? item.stockQuantity
  const ended = !!item.eventEndsAt && new Date(item.eventEndsAt) < new Date()
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent dir={isAr ? "rtl" : "ltr"} onCloseAutoFocus={(event) => { event.preventDefault(); onCloseFocus() }}
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b p-5 pr-12 text-start sm:p-6 sm:pr-14">
          <div className="mb-1"><Badge variant="secondary">{isAr ? "تفاصيل الفعالية" : "Event Details"}</Badge></div>
          <DialogTitle className="break-words text-2xl font-bold"><bdi>{name}</bdi></DialogTitle>
          <DialogDescription>{isAr ? "اطّلع على البرنامج وفئات التذاكر وشروط الحجز قبل الدفع." : "Review the program, ticket options, and booking terms before paying."}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {item.imageUrl && <div className="relative mb-6 aspect-video overflow-hidden rounded-xl bg-muted">
            <Image src={item.imageUrl} alt={name} fill sizes="(max-width: 767px) 100vw, 720px" className="object-cover" />
          </div>}
          <div className="mb-6 grid gap-4 rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm sm:grid-cols-2">
            {schedule.date && <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{schedule.date}</span></p>}
            {schedule.time && <p className="flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{schedule.time} {isAr ? "(بتوقيت السعودية)" : "(Saudi time)"}</span></p>}
            {item.eventLocation && <p className="flex items-start gap-2 sm:col-span-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="break-words">{item.eventLocation}</span></p>}
          </div>
          {!!item.eventAddOns?.length && (
            <section className="mb-6 rounded-xl border p-4">
              <h3 className="mb-3 font-semibold">{isAr ? "إضافات اختيارية لتذكرتك" : "Optional Ticket Add-ons"}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{isAr ? "اختر الإضافات في السلة. الأسعار التالية تضاف إلى سعر كل تذكرة." : "Choose add-ons in your cart. These prices are added to each ticket."}</p>
              <ul className="space-y-3">{item.eventAddOns.map((option) => (
                <li key={option.id} className="flex items-start justify-between gap-4 rounded-lg bg-muted/40 p-3 text-sm">
                  <div className="min-w-0"><p className="font-medium">{isAr ? option.nameAr : option.nameEn}</p>
                    {(option.noteAr || option.noteEn) && <p className="mt-1 whitespace-pre-line break-words leading-6 text-muted-foreground">{isAr ? option.noteAr || option.noteEn : option.noteEn || option.noteAr}</p>}
                  </div>
                  <span className="shrink-0 font-semibold text-primary">{Number(option.price) > 0 ? `+ ${Number(option.price).toFixed(2)} ${isAr ? "ر.س" : "SAR"}` : (isAr ? "مجانية" : "Free")}</span>
                </li>
              ))}</ul>
            </section>
          )}
          <div className="space-y-6">
            {sections.length ? sections.map((lines, index) => (
              <section key={index} className={index ? "border-t pt-5" : ""}>
                <h3 className="mb-3 whitespace-pre-wrap break-words text-base font-bold leading-7">{lines[0]}</h3>
                <div className="space-y-3 break-words text-sm leading-7 text-foreground/80"><DescriptionLines lines={lines.slice(1)} /></div>
              </section>
            )) : <p className="text-sm text-muted-foreground">{isAr ? "لم تُضف تفاصيل للفعالية بعد." : "Event details have not been added yet."}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-card p-4 sm:px-6">
          <div><p className="text-xs text-muted-foreground">{item.eventAddOns?.length ? (isAr ? "تبدأ التذكرة من" : "Tickets from") : (isAr ? "سعر التذكرة" : "Ticket price")}</p>
            <p className="text-xl font-bold text-primary">{Number(item.price).toFixed(2)} <span className="text-sm">{isAr ? "ر.س" : "SAR"}</span></p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Button onClick={onBook} disabled={busy || available <= 0 || ended}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              {adding ? (isAr ? "جاري الإضافة للسلة..." : "Adding to cart...") : ended ? (isAr ? "انتهت الفعالية" : "Event ended") : available <= 0 ? (isAr ? "اكتمل الحجز" : "Sold out") : (isAr ? "احجز الآن" : "Book now")}
            </Button>
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Ticket className="h-3 w-3" />{isAr ? "تُكمل اختيار الإضافات والدفع في السلة" : "Choose add-ons and pay in your cart"}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
