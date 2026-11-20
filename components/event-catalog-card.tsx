"use client"

import Image from "next/image"
import { ArrowUpRight, CalendarDays, Clock3, Loader2, MapPin, Ticket } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { eventSchedule } from "@/lib/event-presentation"
import type { EventAddOn } from "@/lib/event-add-ons"

export interface EventCatalogItem {
  id: string
  nameAr: string
  nameEn: string
  descriptionAr?: string | null
  descriptionEn?: string | null
  price: string
  imageUrl?: string | null
  stockQuantity: number
  availableQuantity?: number
  eventStartsAt?: Date | string | null
  eventEndsAt?: Date | string | null
  eventLocation?: string | null
  eventAddOns?: EventAddOn[]
}

export function EventCatalogCard({ item, isAr, busy, adding, onDetails, onBook }: {
  item: EventCatalogItem; isAr: boolean; busy: boolean; adding: boolean; onDetails: () => void; onBook: () => void
}) {
  const name = isAr ? item.nameAr : item.nameEn
  const available = item.availableQuantity ?? item.stockQuantity
  const ended = !!item.eventEndsAt && new Date(item.eventEndsAt) < new Date()
  const schedule = eventSchedule(item.eventStartsAt, item.eventEndsAt, isAr)
  return (
    <Card onClick={onDetails} className="group flex min-w-0 cursor-pointer flex-col gap-0 overflow-hidden border-border/70 bg-card/95 py-0 shadow-lg transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-xl">
      <button type="button" onClick={(event) => { event.stopPropagation(); onDetails() }}
        aria-label={`${isAr ? "عرض تفاصيل فعالية" : "View event details:"} ${name}`}
        className="relative block aspect-video w-full overflow-hidden bg-muted focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]">
        {item.imageUrl ? <Image src={item.imageUrl} alt={name} fill sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105" />
          : <span className="flex h-full w-full items-center justify-center bg-[#17374A] text-[#E09F48]"><Ticket className="h-16 w-16" /></span>}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <Badge className="absolute bottom-4 start-4 border-white/20 bg-black/35 text-white backdrop-blur-sm">{isAr ? "فعالية نيون" : "Neon Event"}</Badge>
        <span aria-hidden="true" className="absolute bottom-4 end-4 rounded-full bg-white/15 p-2 text-white backdrop-blur-sm"><ArrowUpRight className="h-4 w-4" /></span>
      </button>
      <CardContent className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words text-xl font-bold tracking-tight">
            <button type="button" onClick={(event) => { event.stopPropagation(); onDetails() }} className="text-start hover:text-primary focus-visible:outline-primary"><bdi>{name}</bdi></button>
          </h2>
          <Badge variant="secondary" className="shrink-0">{ended ? (isAr ? "انتهت" : "Ended") : available <= 0 ? (isAr ? "مكتملة" : "Sold out") : (isAr ? "الحجز متاح" : "Booking open")}</Badge>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          {schedule.date && <p className="flex items-start gap-2.5"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{schedule.date}</span></p>}
          {schedule.time && <p className="flex items-start gap-2.5"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{schedule.time} <span className="text-xs">{isAr ? "(بتوقيت السعودية)" : "(Saudi time)"}</span></span></p>}
          {item.eventLocation && <p className="flex items-start gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="break-words">{item.eventLocation}</span></p>}
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border/70 pt-4">
          <div><p className="mb-1 text-xs text-muted-foreground">{item.eventAddOns?.length ? (isAr ? "تبدأ التذكرة من" : "Tickets from") : (isAr ? "سعر التذكرة" : "Ticket price")}</p>
            <p className="text-2xl font-bold text-primary">{Number(item.price).toFixed(2)} <span className="text-sm font-medium">{isAr ? "ر.س" : "SAR"}</span></p>
          </div>
          <p className="text-xs text-muted-foreground">{available > 0 && !ended ? `${available} ${isAr ? "تذكرة متاحة" : "tickets available"}` : (isAr ? "الدخول بتذكرة رقمية" : "Digital ticket admission")}</p>
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-3 px-5 pb-5 sm:px-6 sm:pb-6">
        <Button variant="outline" onClick={(event) => { event.stopPropagation(); onDetails() }}>{isAr ? "تفاصيل الفعالية" : "Event details"}</Button>
        <Button onClick={(event) => { event.stopPropagation(); onBook() }} disabled={busy || available <= 0 || ended}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
          {adding ? (isAr ? "جاري الإضافة..." : "Adding...") : ended ? (isAr ? "انتهت الفعالية" : "Event ended") : available <= 0 ? (isAr ? "اكتمل الحجز" : "Sold out") : (isAr ? "احجز الآن" : "Book now")}
        </Button>
      </CardFooter>
    </Card>
  )
}
