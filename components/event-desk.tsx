"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Camera, CheckCircle2, ClipboardCheck, Loader2, MapPin, QrCode, ShieldCheck, Ticket, Users, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { SelectedEventAddOn } from "@/lib/event-add-ons"

interface EventProduct {
  id: string
  nameAr: string
  nameEn: string
  eventStartsAt: string
  eventEndsAt: string
  eventLocation: string
  isActive: boolean
  ticketCount: number
  attendanceCount: number
  waitingCount: number
}
interface DeskData {
  events: EventProduct[]
  attendance: { id: string; checkedInAt: string; attendeeName: string; staffName: string; addOns?: SelectedEventAddOn[] }[]
  staff: { id: string; name: string; email: string }[]
  assignments: { productId: string; userId: string }[]
  isAdmin: boolean
  paymentReady?: boolean
}

export function EventDesk({ lang }: { lang: string }) {
  const isAr = lang === "ar"
  const [data, setData] = useState<DeskData | null>(null)
  const [selectedId, setSelectedId] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [staffBusy, setStaffBusy] = useState<string | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ ok: boolean; message: string; name?: string; addOns?: SelectedEventAddOn[] } | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const cameraGeneration = useRef(0)
  const scanningRef = useRef(false)
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  const errors: Record<string, string> = {
    FORBIDDEN: isAr ? "لا تملك صلاحية هذه الفعالية. تواصل مع الأدمن." : "You are not assigned to this event.",
    UNAUTHENTICATED: isAr ? "انتهت الجلسة. سجّل دخولك مجدداً." : "Your session expired. Sign in again.",
    INVALID_TICKET: isAr ? "تذكرة غير صحيحة أو تخص فعالية أخرى." : "Invalid ticket or a ticket for another event.",
    ALREADY_CHECKED_IN: isAr ? "هذه التذكرة مستخدمة مسبقاً. لم يُسجّل حضور جديد." : "This ticket was already used. No new admission recorded.",
    NOT_ADMISSIBLE: isAr ? "التذكرة ملغاة، أو الدفع غير مؤكد، أو الدخول غير متاح الآن." : "Ticket revoked, payment unconfirmed, or admission is closed.",
    RATE_LIMITED: isAr ? "وصلت للحد المسموح. انتظر دقيقة ثم أعد المحاولة." : "Rate limit reached. Wait a minute and retry.",
    INVALID_ASSIGNMENT: isAr ? "تعذر تعديل التعيين. تحقق من دور الموظف." : "Cannot update assignment. Check the staff role.",
  }
  const message = (key: string) => errors[key] || (isAr ? "تعذر تنفيذ العملية. أعد المحاولة." : "Unable to complete the request. Please retry.")

  const stopCamera = useCallback(() => {
    cameraGeneration.current++
    controlsRef.current?.stop()
    controlsRef.current = null
    const stream = videoRef.current?.srcObject
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
    setCameraStarting(false)
  }, [])

  useEffect(() => () => {
    cameraGeneration.current++
    controlsRef.current?.stop()
    const stream = videoRef.current?.srcObject
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => {
    const onHidden = () => { if (document.hidden) stopCamera() }
    document.addEventListener("visibilitychange", onHidden)
    return () => document.removeEventListener("visibilitychange", onHidden)
  }, [stopCamera])

  const load = useCallback(async (id: string, signal?: AbortSignal) => {
    const response = await fetch(`/api/events${id ? `?productId=${encodeURIComponent(id)}` : ""}`, { cache: "no-store", signal })
    const next = await response.json()
    if (!response.ok) throw new Error(next.error)
    if (selectedRef.current && id !== selectedRef.current) return
    setData(next)
    if (!id && next.events.length) setSelectedId(next.events[0].id)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(selectedId, controller.signal)
      .then(() => setError(""))
      .catch((e) => { if (e.name !== "AbortError") setError(message(e.message)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, load])

  async function scan(value: string) {
    if (scanningRef.current || !selectedId || !value.trim()) return
    scanningRef.current = true
    const scannedEvent = selectedId
    setBusy(true)
    setResult(null)
    stopCamera()
    try {
      const response = await fetch("/api/events/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: scannedEvent, code: value.trim() }),
      })
      const body = await response.json()
      if (selectedRef.current !== scannedEvent) return
      if (!response.ok) throw new Error(body.error)
      setResult({ ok: true, message: isAr ? "تم تسجيل الحضور بنجاح" : "Admission recorded", name: body.attendeeName, addOns: body.addOns })
      setCode("")
      await load(scannedEvent).catch(() => setError(isAr ? "تم الحضور، لكن تعذر تحديث القائمة." : "Admission saved, but the list could not refresh."))
    } catch (e) {
      if (selectedRef.current === scannedEvent) setResult({ ok: false, message: message(e instanceof Error ? e.message : "") })
    } finally {
      scanningRef.current = false
      setBusy(false)
    }
  }

  async function startCamera() {
    if (!selectedId || cameraStarting || cameraOn || busy) return
    const generation = ++cameraGeneration.current
    setError("")
    setResult(null)
    setCameraStarting(true)
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("CAMERA_UNAVAILABLE")
      }
      const { BrowserQRCodeReader } = await import("@zxing/browser")
      if (generation !== cameraGeneration.current || !videoRef.current) return
      const reader = new BrowserQRCodeReader()
      const controls = await reader.decodeFromConstraints({
        video: { facingMode: { ideal: "environment" } }, audio: false,
      }, videoRef.current, (decoded, _error, currentControls) => {
        if (decoded && generation === cameraGeneration.current && !scanningRef.current) {
          currentControls.stop()
          void scan(decoded.getText())
        }
      })
      if (generation !== cameraGeneration.current) { controls.stop(); return }
      controlsRef.current = controls
      setCameraOn(true)
    } catch {
      if (generation === cameraGeneration.current) {
        stopCamera()
        setError(isAr ? "تعذر تشغيل الكاميرا. اسمح بالوصول واستخدم HTTPS، أو استخدم قارئ الباركود." : "Camera unavailable. Allow access over HTTPS, or use a barcode reader.")
      }
    } finally {
      if (generation === cameraGeneration.current) setCameraStarting(false)
    }
  }

  async function assignStaff(userId: string, assigned: boolean) {
    setStaffBusy(userId)
    setError("")
    try {
      const response = await fetch("/api/events/staff", {
        method: assigned ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedId, userId }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      await load(selectedId)
    } catch (e) { setError(message(e instanceof Error ? e.message : "")) }
    finally { setStaffBusy(null) }
  }

  const selected = data?.events.find((event) => event.id === selectedId)
  const date = (value: string) => new Date(value).toLocaleString(isAr ? "ar-SA" : "en-GB")
  return (
    <div className="mx-auto max-w-6xl space-y-6" dir={isAr ? "rtl" : "ltr"}>
      <section className="relative overflow-hidden rounded-2xl bg-[#17374A] p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-[#E09F48]"><ShieldCheck className="h-5 w-5" />{isAr ? "دخول موثّق • تذكرة واحدة لكل حضور" : "Verified entry • One admission per ticket"}</div>
            <h1 className="text-2xl font-bold sm:text-3xl">{isAr ? "مركز حضور الفعاليات" : "Event Admission Desk"}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">{isAr ? "اختر الفعالية ثم امسح التذكرة. يُتحقق من الصلاحية والدفع ووقت الدخول قبل تسجيل الحضور." : "Select an event and scan a ticket. Permission, payment and admission times are verified before entry."}</p>
          </div>
          {data?.isAdmin && <Button asChild className="bg-[#E09F48] text-[#17374A] hover:bg-[#E09F48]/90"><Link href={`/${lang}/admin/store/new`}>{isAr ? "إنشاء تذكرة فعالية" : "Create event product"}</Link></Button>}
        </div>
      </section>
      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      {data?.isAdmin && !data.paymentReady && <div role="alert" className="rounded-xl border border-[#E09F48]/40 bg-[#E09F48]/10 p-4 text-sm">{isAr ? "بيع التذاكر مقفل لحين ضبط مفاتيح Stream Pay على السيرفر. يُتحقق من الدفع مباشرة عبر بوابة الدفع." : "Ticket sales require Stream Pay API credentials. Payments are verified directly with the gateway."}</div>}
      {loading ? <div className="flex justify-center p-16"><Loader2 className="h-7 w-7 animate-spin" /></div> : !data?.events.length ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><Ticket className="h-10 w-10 text-muted-foreground" /><h2 className="font-semibold">{isAr ? "لا توجد فعاليات متاحة لك" : "No assigned events"}</h2><p className="text-sm text-muted-foreground">{isAr ? "على الأدمن إنشاء منتج من نوع تذكرة فعالية وتعيين الموظفين عليه." : "An admin must create an event ticket product and assign staff."}</p><Button variant="outline" onClick={() => load("").catch(() => setError(message("")))}>{isAr ? "تحديث" : "Refresh"}</Button></CardContent></Card>
      ) : (
        <>
          <Card><CardContent className="grid gap-5 pt-6 md:grid-cols-2">
            <div className="space-y-2"><Label>{isAr ? "الفعالية" : "Event"}</Label><Select value={selectedId} disabled={busy || !!staffBusy} onValueChange={(id) => { stopCamera(); setSelectedId(id); setCode(""); setResult(null) }}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{data.events.map((event) => <SelectItem key={event.id} value={event.id}>{isAr ? event.nameAr : event.nameEn}</SelectItem>)}</SelectContent>
            </Select></div>
            {selected && <div className="space-y-2 text-sm text-muted-foreground"><p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{selected.eventLocation}</p><p>{date(selected.eventStartsAt)} - {date(selected.eventEndsAt)}</p>{!selected.isActive && <Badge variant="destructive">{isAr ? "الفعالية معطلة" : "Event inactive"}</Badge>}</div>}
          </CardContent></Card>
          <div className="grid gap-4 sm:grid-cols-3">
            {[{ icon: Ticket, title: isAr ? "التذاكر الفعالة" : "Valid tickets", value: selected?.ticketCount || 0 },
              { icon: ClipboardCheck, title: isAr ? "الحضور المسجل" : "Admitted", value: selected?.attendanceCount || 0 },
              { icon: Users, title: isAr ? "بانتظار الحضور" : "Awaiting entry", value: selected?.waitingCount || 0 }].map((stat) => (
              <Card key={stat.title}><CardContent className="flex items-center gap-4 pt-6"><div className="rounded-xl bg-[#2F5257]/10 p-3 text-[#2F5257] dark:text-[#E09F48]"><stat.icon className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">{stat.title}</p><p className="mt-1 text-2xl font-bold">{stat.value}</p></div></CardContent></Card>
            ))}
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><QrCode className="h-5 w-5" />{isAr ? "مسح التذكرة" : "Scan a ticket"}</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className={`relative overflow-hidden rounded-xl bg-[#17374A] ${cameraOn || cameraStarting ? "block" : "hidden"}`}><video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" /></div>
              <Button className="w-full" variant={cameraOn ? "outline" : "default"} disabled={busy || cameraStarting} onClick={cameraOn ? stopCamera : startCamera}><Camera className="me-2 h-4 w-4" />{cameraStarting ? (isAr ? "تشغيل الكاميرا..." : "Starting camera...") : cameraOn ? (isAr ? "إيقاف الكاميرا" : "Stop camera") : (isAr ? "تشغيل كاميرا المسح" : "Scan with camera")}</Button>
              <form onSubmit={(e) => { e.preventDefault(); void scan(code) }} className="space-y-3">
                <Label htmlFor="event-ticket-code">{isAr ? "قارئ الباركود أو إدخال الرمز" : "Barcode reader or ticket code"}</Label>
                <Input id="event-ticket-code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} maxLength={160} autoComplete="off" spellCheck={false} disabled={busy} placeholder="NEVT1.…" />
                <Button type="submit" className="w-full bg-[#2F5257] text-white hover:bg-[#2F5257]/90" disabled={busy || !code.trim()}>{busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{isAr ? "التحقق وتسجيل الحضور" : "Verify and admit"}</Button>
              </form>
              {result && <div role="status" aria-live="polite" className={`flex gap-3 rounded-xl border p-4 ${result.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{result.ok ? <CheckCircle2 className="h-6 w-6 shrink-0" /> : <XCircle className="h-6 w-6 shrink-0" />}<div><p className="font-semibold">{result.message}</p>{result.name && <p className="mt-1 text-sm">{result.name}</p>}{!!result.addOns?.length && <p className="mt-2 text-sm">{isAr ? "مزايا التذكرة: " : "Ticket add-ons: "}{result.addOns.map((option) => isAr ? option.nameAr : option.nameEn).join(", ")}</p>}</div></div>}
              <p className="text-xs leading-6 text-muted-foreground">{isAr ? "المسح يتوقف بعد كل تذكرة. لا يتم تسجيل حضور في وضع عدم الاتصال." : "Scanning pauses after every ticket. Offline admission is not supported."}</p>
            </CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg">{isAr ? "آخر الحضور" : "Recent admissions"}</CardTitle><Button size="sm" variant="outline" onClick={() => load(selectedId).catch(() => setError(message("")))}>{isAr ? "تحديث" : "Refresh"}</Button></CardHeader><CardContent>
              {!data.attendance.length ? <p className="py-10 text-center text-sm text-muted-foreground">{isAr ? "لم يُسجّل حضور بعد" : "No admissions yet"}</p> : <div className="max-h-96 space-y-3 overflow-y-auto">{data.attendance.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-semibold">{item.attendeeName}</p><p className="mt-1 text-xs text-muted-foreground">{item.staffName}</p>{!!item.addOns?.length && <p className="mt-1 text-xs text-primary">{item.addOns.map((option) => isAr ? option.nameAr : option.nameEn).join(", ")}</p>}</div><span className="text-xs text-muted-foreground">{date(item.checkedInAt)}</span></div>)}</div>}
            </CardContent></Card>
          </div>
          {data.isAdmin && <Card><CardHeader><CardTitle className="text-lg">{isAr ? "موظفو هذه الفعالية" : "Assigned staff"}</CardTitle><p className="text-sm text-muted-foreground">{isAr ? "أنشئ المستخدم بدور موظف فعاليات أولاً. سحب التعيين يمنع المسح مباشرة." : "Create users with the event staff role first. Revoking assignment immediately blocks scanning."}</p></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
            {!data.staff.length && <p className="text-sm text-muted-foreground">{isAr ? "لا يوجد موظفون. أضف موظفاً من المستخدمين والصلاحيات." : "No event staff. Add staff in Users & Roles."}</p>}
            {data.staff.map((staff) => {
              const assigned = data.assignments.some((a) => a.productId === selectedId && a.userId === staff.id)
              return <div key={staff.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{staff.name}</p><p className="truncate text-xs text-muted-foreground" dir="ltr">{staff.email}</p></div><Button size="sm" variant={assigned ? "destructive" : "outline"} disabled={!!staffBusy} onClick={() => assignStaff(staff.id, assigned)}>{staffBusy === staff.id ? <Loader2 className="h-4 w-4 animate-spin" /> : assigned ? (isAr ? "سحب الصلاحية" : "Remove") : (isAr ? "تعيين" : "Assign")}</Button></div>
            })}
          </CardContent></Card>}
        </>
      )}
    </div>
  )
}
