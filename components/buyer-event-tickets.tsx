"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2, MapPin, ShieldCheck, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface BuyerTicket {
  id: string
  ordinal: number
  nameAr: string
  nameEn: string
  eventStartsAt: string
  eventEndsAt: string
  eventLocation: string
  checkedInAt: string | null
  revokedAt: string | null
  code: string | null
  qr: string | null
}

export function BuyerEventTickets({ lang, orderId }: { lang: string; orderId?: string }) {
  const isAr = lang === "ar"
  const [tickets, setTickets] = useState<BuyerTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [pageCursor, setPageCursor] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    const query = new URLSearchParams()
    if (pageCursor) query.set("cursor", pageCursor)
    if (orderId) query.set("orderId", orderId)
    fetch(`/api/tickets?${query.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed")
        const data = await response.json()
        setTickets((previous) => pageCursor ? [...previous, ...data.tickets] : data.tickets)
        setNextCursor(data.nextCursor)
        setError(false)
      })
      .catch((e) => { if (e.name !== "AbortError") setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh, pageCursor, orderId])

  return (
    <section className="mb-8 space-y-4" aria-label={isAr ? "تذاكر الفعاليات" : "Event tickets"}>
      <div className="flex items-center justify-between gap-4"><h2 className="flex items-center gap-2 text-xl font-bold"><Ticket className="h-5 w-5 text-primary" />{isAr ? "تذاكر فعالياتي" : "My Event Tickets"}</h2><Button size="sm" variant="outline" disabled={loading} onClick={() => { setPageCursor(null); setRefresh((value) => value + 1) }}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? "تحديث التذاكر" : "Refresh tickets")}</Button></div>
      {error ? <p role="alert" className="text-sm text-destructive">{isAr ? "تعذر تحميل التذاكر. أعد المحاولة." : "Unable to load tickets. Please retry."}</p> : !loading && !tickets.length ? <p className="text-sm text-muted-foreground">{isAr ? "تظهر تذاكر الفعاليات هنا بعد تأكيد الدفع." : "Your event tickets appear here after payment confirmation."}</p> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tickets.map((ticket) => {
            const expired = new Date(ticket.eventEndsAt) < new Date()
            const usable = !ticket.revokedAt && !ticket.checkedInAt && !expired
            return <Card key={ticket.id} className="min-w-0 overflow-hidden border-border bg-card text-card-foreground shadow-sm"><div className="bg-[#17374A] px-5 py-4 text-white"><div className="flex justify-between gap-3"><h3 className="min-w-0 break-words font-bold">{isAr ? ticket.nameAr : ticket.nameEn}</h3><Ticket className="h-5 w-5 shrink-0 text-[#E09F48]" /></div><p className="mt-2 text-xs text-white/70">{isAr ? "التذكرة" : "Ticket"} #{ticket.ordinal}</p></div><CardContent className="space-y-4 pt-5">
              <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />{ticket.eventLocation}</p><p className="text-xs text-muted-foreground">{new Date(ticket.eventStartsAt).toLocaleString(isAr ? "ar-SA" : "en-GB")} - {new Date(ticket.eventEndsAt).toLocaleString(isAr ? "ar-SA" : "en-GB")}</p>
              {usable && ticket.qr ? (
                <div className="space-y-3 text-center">
                  {/* رمز التذكرة يُولّد محلياً ولا يُرسل إلى خدمات صور خارجية. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ticket.qr} width={320} height={320} className="mx-auto w-full max-w-64 rounded-xl border bg-white" alt={isAr ? "رمز QR للدخول" : "Admission QR code"} />
                  <Button size="sm" variant="outline" onClick={() => {
                    if (ticket.code) navigator.clipboard.writeText(ticket.code).catch(() => setError(true))
                  }}>{isAr ? "نسخ رمز التذكرة" : "Copy ticket code"}</Button>
                </div>
              ) : <div className="py-8 text-center"><CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><Badge variant={ticket.revokedAt ? "destructive" : "secondary"}>{ticket.revokedAt ? (isAr ? "التذكرة ملغاة" : "Revoked") : ticket.checkedInAt ? (isAr ? "تم تسجيل الحضور" : "Admitted") : (isAr ? "انتهت الفعالية" : "Event ended")}</Badge></div>}
              <p className="flex items-start gap-2 border-t pt-3 text-xs leading-6 text-muted-foreground"><ShieldCheck className="mt-1 h-4 w-4 shrink-0" />{isAr ? "لا تشارك الرمز. صالح لدخول شخص واحد ولمرة واحدة فقط." : "Keep your code private. Valid for one person and one admission."}</p>
            </CardContent></Card>
          })}
        </div>
      )}
      {nextCursor && !error && <Button variant="outline" disabled={loading} onClick={() => setPageCursor(nextCursor)}>{isAr ? "عرض تذاكر إضافية" : "Load more tickets"}</Button>}
      {error && pageCursor && <Button variant="outline" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>{isAr ? "إعادة المحاولة" : "Retry"}</Button>}
    </section>
  )
}
