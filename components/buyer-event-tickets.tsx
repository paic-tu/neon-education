"use client"

import { useEffect, useState } from "react"
import { CalendarDays, CheckCircle2, Copy, Loader2, MapPin, RefreshCw, ShieldCheck, Ticket, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { SelectedEventAddOn } from "@/lib/event-add-ons"

interface BuyerTicket {
  id: string
  ordinal: number
  ticketNumber: number
  addOns?: SelectedEventAddOn[]
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
  const [walletAvailable, setWalletAvailable] = useState(false)
  const [walletLoading, setWalletLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
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
        setWalletAvailable(data.walletAvailable === true)
        setError(false)
      })
      .catch((e) => { if (e.name !== "AbortError") setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh, pageCursor, orderId])

  const addToWallet = async (ticketId: string) => {
    if (walletLoading) return
    setWalletLoading(ticketId)
    setActionError(null)
    try {
      const response = await fetch(`/api/tickets/${ticketId}/wallet?lang=${isAr ? "ar" : "en"}`, { cache: "no-store" })
      if (!response.ok || !response.headers.get("content-type")?.includes("application/vnd.apple.pkpass")) throw new Error("Wallet unavailable")
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement("a")
      link.href = url
      link.download = `neon-ticket-${ticketId}.pkpass`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      setActionError(isAr ? "تعذر إضافة التذكرة للمحفظة. يمكنك استخدام الباركود أدناه أو إعادة المحاولة." : "Unable to add the pass. Use your barcode below or try again.")
    } finally { setWalletLoading(null) }
  }

  return (
    <section dir={isAr ? "rtl" : "ltr"} className="mb-8 space-y-6" aria-label={isAr ? "تذاكر الفعاليات" : "Event tickets"} aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Ticket className="h-5 w-5 text-primary" />{isAr ? "تذاكر فعالياتي" : "My Event Tickets"}</h2><p className="mt-2 text-sm text-muted-foreground">{isAr ? "كل بطاقة أدناه تمثل تذكرة دخول مستقلة." : "Each card below is an individual admission ticket."}</p></div>
        <Button size="sm" variant="outline" className="bg-card" disabled={loading} onClick={() => { setPageCursor(null); setRefresh((value) => value + 1) }}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{isAr ? "تحديث" : "Refresh"}</Button>
      </div>
      {actionError && <p role="alert" className="rounded-xl border border-destructive bg-card p-4 text-sm text-destructive">{actionError}</p>}
      {loading && !tickets.length && <div className="flex items-center justify-center gap-3 rounded-2xl border bg-card p-12 text-muted-foreground" role="status"><Loader2 className="h-5 w-5 animate-spin" />{isAr ? "جاري تحميل تذاكرك..." : "Loading your tickets..."}</div>}
      {error ? <p role="alert" className="text-sm text-destructive">{isAr ? "تعذر تحميل التذاكر. أعد المحاولة." : "Unable to load tickets. Please retry."}</p> : !loading && !tickets.length ? <p className="text-sm text-muted-foreground">{isAr ? "تظهر تذاكر الفعاليات هنا بعد تأكيد الدفع." : "Your event tickets appear here after payment confirmation."}</p> : (
        <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
          {tickets.map((ticket) => {
            const expired = new Date(ticket.eventEndsAt) < new Date()
            const usable = !ticket.revokedAt && !ticket.checkedInAt && !expired
            return <Card key={ticket.id} className="min-w-0 overflow-hidden rounded-2xl border-border bg-card text-card-foreground shadow-lg shadow-black/5">
              <div className="border-b-4 border-primary bg-[#17132B] px-6 py-6 text-white">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-lg font-bold">{isAr ? "نيون التعليمية" : "NEON Education"}</p>
                    <p className="text-xs font-medium text-[#CEBDFF]">{isAr ? "تذكرة دخول الفعالية" : "Event Admission Ticket"}</p>
                  </div>
                  <Ticket aria-hidden="true" className="h-6 w-6 shrink-0 text-[#CEBDFF]" />
                </div>
                <p className="mb-2 text-xs text-[#CEBDFF]">{isAr ? "اسم الفعالية" : "Event Name"}</p>
                <h3 className="break-words text-2xl font-bold leading-relaxed"><bdi>{(isAr ? ticket.nameAr : ticket.nameEn) || ticket.nameEn || ticket.nameAr}</bdi></h3>
                <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-white/15 pt-4">
                  <div className="space-y-1">
                    <p className="text-xs text-[#CEBDFF]">{isAr ? "رقم التذكرة" : "Ticket Number"}</p>
                    <p className="w-fit font-mono text-base font-semibold" dir="ltr">#{String(ticket.ticketNumber).padStart(2, "0")}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[#CEBDFF]">{isAr ? "حالة التذكرة" : "Ticket Status"}</p>
                    <Badge className="max-w-full whitespace-normal border-white/20 bg-white/10 text-white" variant="outline">
                      {usable ? (isAr ? "صالحة للدخول" : "Valid for Admission") : ticket.revokedAt ? (isAr ? "تذكرة ملغاة" : "Revoked") : ticket.checkedInAt ? (isAr ? "تم تسجيل الحضور" : "Attendance Recorded") : (isAr ? "منتهية الصلاحية" : "Expired")}
                    </Badge>
                  </div>
                </div>
              </div>
              <CardContent className="space-y-5 p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3"><MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><p className="mb-1 text-xs text-muted-foreground">{isAr ? "مكان الفعالية" : "VENUE"}</p><p className="break-words text-sm font-medium">{ticket.eventLocation}</p></div></div>
                <div className="flex items-start gap-3"><CalendarDays className="mt-1 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><p className="mb-1 text-xs text-muted-foreground">{isAr ? "تاريخ الفعالية" : "EVENT DATE"}</p><p className="text-sm font-medium">{new Date(ticket.eventStartsAt).toLocaleDateString(isAr ? "ar-SA-u-ca-gregory" : "en-GB", { timeZone: "Asia/Riyadh", dateStyle: "medium" })}</p></div></div>
                {!!ticket.addOns?.length && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="mb-2 text-sm font-semibold">{isAr ? "مزايا تذكرتك" : "Your Ticket Add-ons"}</p>
                    <ul className="space-y-2 text-sm">{ticket.addOns.map((option) => (
                      <li key={option.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block">{isAr ? option.nameAr : option.nameEn}</span>
                          {(option.noteAr || option.noteEn) && <span className="mt-1 block whitespace-pre-line text-xs text-muted-foreground">
                            {isAr ? option.noteAr || option.noteEn : option.noteEn || option.noteAr}
                          </span>}
                        </span>
                        <Badge variant="secondary">{isAr ? "ضمن هذه التذكرة" : "Included with this ticket"}</Badge>
                      </li>
                    ))}</ul>
                  </div>
                )}
              </div>
              <div className="space-y-3 rounded-xl border border-border bg-muted p-4">
                <p className="flex items-center gap-2 text-sm font-semibold"><Wallet className="h-4 w-4 text-primary" />{isAr ? "محفظة Apple" : "Apple Wallet"}</p>
                <Button className="w-full bg-black text-white hover:bg-neutral-800 disabled:opacity-60" disabled={!usable || !ticket.qr || !walletAvailable || walletLoading !== null} onClick={() => addToWallet(ticket.id)} aria-describedby={`wallet-help-${ticket.id}`}>
                  {walletLoading === ticket.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}{isAr ? "إضافة إلى Apple Wallet" : "Add to Apple Wallet"}
                </Button>
                <p id={`wallet-help-${ticket.id}`} className="text-xs leading-5 text-muted-foreground">
                  {!usable
                    ? (isAr ? "إضافة المحفظة متاحة للتذاكر السارية وغير المستخدمة فقط." : "Wallet is available only for valid, unused tickets.")
                    : !walletAvailable
                      ? (isAr ? "إضافة المحفظة غير متاحة حاليًا حتى تفعيل شهادات Apple. يمكنك استخدام الباركود للدخول." : "Wallet requires Apple signing certificates to be enabled. Use your barcode for admission.")
                      : (isAr ? "افتح الملف على iPhone لإضافته إلى المحفظة." : "Open the pass on your iPhone to add it to Wallet.")}
                </p>
              </div>
              <div className="border-t border-dashed border-border" />
              {ticket.qr && !ticket.revokedAt ? (
                <div className="space-y-3 text-center">
                  {ticket.checkedInAt && <div role="status" className="rounded-lg border border-border bg-muted p-3 text-sm"><CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-primary" />{isAr ? "تم تسجيل حضورك. الباركود محفوظ، ولا يسمح بدخول آخر." : "Your attendance is recorded. The barcode remains visible but cannot admit you again."}</div>}
                  {expired && !ticket.checkedInAt && <p className="rounded-lg bg-muted p-3 text-sm">{isAr ? "انتهت الفعالية. الباركود محفوظ للعرض فقط." : "This event has ended. The barcode is retained for reference only."}</p>}
                  {/* رمز التذكرة يُولّد محلياً ولا يُرسل إلى خدمات صور خارجية. */}
                  <div className="relative mx-auto w-full max-w-64 overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ticket.qr} width={320} height={320} className="w-full rounded-xl border border-gray-200 bg-white" alt={isAr ? "رمز QR للدخول" : "Admission QR code"} />
                    {/* Keep the QR corner patterns clear so the sweep does not interfere with detection. */}
                    <div aria-hidden="true" data-ticket-sweep className="pointer-events-none absolute inset-0 motion-reduce:hidden" style={{ clipPath: "polygon(20% 0,80% 0,80% 20%,100% 20%,100% 80%,80% 80%,80% 100%,20% 100%,20% 80%,0 80%,0 20%,20% 20%)" }}>
                      <div className="relative h-full w-full motion-safe:animate-[spin_0.3s_linear_infinite]">
                        <span className="absolute left-0 top-1/2 h-[3px] w-full -translate-y-1/2 bg-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{isAr ? "المؤشر المتحرك لا يمنع تصوير الشاشة أو استخدام نسخة من الرمز." : "The animated marker does not prevent screenshots or copies of the code."}</p>
                  <p className="text-xs text-muted-foreground">{usable ? (isAr ? "اعرض هذا الباركود لموظف الفعالية عند الدخول" : "Present this barcode to event staff at admission") : (isAr ? "هذا الباركود للعرض فقط، وليس لدخول جديد." : "This barcode is for reference, not another admission.")}</p>
                  <Button size="sm" variant="ghost" className="w-full" onClick={async () => {
                    try {
                      if (!ticket.code) return
                      await navigator.clipboard.writeText(ticket.code)
                      setCopied(ticket.id)
                      setActionError(null)
                    } catch { setActionError(isAr ? "تعذر نسخ الرمز. استخدم الباركود المعروض." : "Unable to copy. Use the displayed barcode.") }
                  }}><Copy className="h-4 w-4" />{copied === ticket.id ? (isAr ? "تم نسخ الرمز" : "Code copied") : (isAr ? "نسخ رمز التذكرة" : "Copy ticket code")}</Button>
                </div>
              ) : <div className="py-8 text-center"><CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><Badge variant={ticket.revokedAt ? "destructive" : "secondary"}>{ticket.revokedAt ? (isAr ? "التذكرة ملغاة" : "Revoked") : ticket.checkedInAt ? (isAr ? "تم تسجيل الحضور" : "Admitted") : (isAr ? "انتهت الفعالية" : "Event ended")}</Badge></div>}
              <p className="flex items-start gap-2 border-t pt-4 text-xs leading-6 text-muted-foreground"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-primary" />{isAr ? "تذكرة شخصية وآمنة. لا تشارك الرمز؛ صالح لدخول شخص واحد ولمرة واحدة فقط." : "Personal, secure admission. Keep your code private; valid for one person and one admission."}</p>
            </CardContent></Card>
          })}
        </div>
      )}
      {nextCursor && !error && <Button variant="outline" disabled={loading} onClick={() => setPageCursor(nextCursor)}>{isAr ? "عرض تذاكر إضافية" : "Load more tickets"}</Button>}
      {error && pageCursor && <Button variant="outline" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>{isAr ? "إعادة المحاولة" : "Retry"}</Button>}
    </section>
  )
}
