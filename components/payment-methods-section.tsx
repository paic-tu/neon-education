"use client"

import * as React from "react"
import Image from "next/image"
import { ShieldCheck } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

const baseCardClass =
  "group inline-flex h-9 w-[68px] sm:h-10 sm:w-[76px] items-center justify-center rounded-md border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/70 transition-all duration-200 p-1 overflow-hidden"

function PayLogo({
  src,
  alt,
  extClass = "",
  height = 18,
  width = 56,
}: {
  src: string
  alt: string
  extClass?: string
  height?: number
  width?: number
}) {
  return (
    <div className={`${baseCardClass} ${extClass}`} aria-label={alt} title={alt}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={false}
        draggable={false}
        className="w-auto max-w-[92%] max-h-[72%] object-contain select-none"
        style={{ height: "auto" }}
      />
    </div>
  )
}

function VisaIcon() {
  return <PayLogo src="/payment-logos/visa.svg" alt="Visa" />
}

function MastercardIcon() {
  return <PayLogo src="/payment-logos/mastercard.webp" alt="Mastercard" />
}

function ApplePayIcon() {
  const [logoLum, setLogoLum] = React.useState<"auto" | "light" | "dark">("auto")

  React.useEffect(() => {
    let cancelled = false
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        ctx.drawImage(img, 0, 0)
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let vis = 0
        let sumLum = 0
        for (let i = 0; i < d.length; i += 16) {
          const a = d[i + 3]
          if (a > 16) {
            vis++
            const r = d[i], g = d[i + 1], b = d[i + 2]
            sumLum += 0.2126 * r + 0.7152 * g + 0.0722 * b
          }
        }
        const avgLum = vis ? sumLum / vis : 128
        setLogoLum(avgLum > 140 ? "light" : "dark")
      } catch {
        setLogoLum("auto")
      }
    }
    img.onerror = () => setLogoLum("auto")
    img.src = "/payment-logos/apple-pay.png"
    return () => { cancelled = true }
  }, [])

  const isDarkLogo = logoLum === "dark"
  const needsInvert = isDarkLogo
  const bgClass = !needsInvert
    ? "!bg-black dark:!bg-black !border-slate-800/70 dark:!border-slate-700"
    : "!bg-white dark:!bg-slate-900 !border-slate-200/80 dark:!border-slate-700/70"

  return (
    <div
      aria-label="Apple Pay"
      title="Apple Pay"
      className={`${baseCardClass} ${bgClass} !p-0`}
    >
      <Image
        src="/payment-logos/apple-pay.png"
        alt="Apple Pay"
        width={76}
        height={40}
        priority={false}
        draggable={false}
        className={`w-full h-full object-cover select-none ${needsInvert ? "dark:invert-0 invert-[1] brightness-110" : ""}`}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  )
}

function GooglePayIcon() {
  return <PayLogo src="/payment-logos/google-pay.webp" alt="Google Pay" />
}

function StreamPayIcon() {
  return (
    <div
      aria-label="Stream Pay"
      title="Stream Pay"
      className={`${baseCardClass} !bg-gradient-to-br !from-violet-500 !via-indigo-500 !to-purple-600 !border-violet-400/40 dark:!border-violet-400/30`}
    >
      <svg viewBox="0 0 58 20" className="w-auto h-[17px] text-white drop-shadow-[0_1px_1px_rgba(76,29,149,0.45)]" aria-hidden="true" shapeRendering="geometricPrecision">
        <path fill="currentColor" d="M5 8.6c0-.8.7-1.5 1.6-1.5h7.3c.9 0 1.6.7 1.6 1.5v2.8c0 .8-.7 1.5-1.6 1.5H6.6c-.9 0-1.6-.7-1.6-1.5V8.6Zm3 1.8h1l.6-.9.6.9h1l-1.1-1.6h-.8l-.6.9-.8-.9h-.8L8 10.4Zm3.1-.6h1.3v.8h-1.3V9.8Zm2 0h1.3v.8h-1.3V9.8Zm4-1V13h1.4l1.8-2.8 1.8 2.8H58V8.8h-1.4l.9 1.4v-1.4h-1.4v3.1l-1.4-2.2-1.4 2.2V8.8h-1.3v1.5l1.4-1.5h-.9l-1.5 3.1-1.5-3.1H51v1.5l.9 1.4v-1.4H50v4.2h1.3L51.8 10l1.4 2.2V8.8Zm-16.7 0v1.4h1.9v1.5H32v-2.7h2.4v-.4h-2.4V9h2.4V7.8h-3.7L32 10.4v-1.6Zm11.2-1L43.8 13h1.6l1.3-5.2h-1.5l-.8 3.2-.8-3.2h-1.6L42 9.8Zm3.8 0v4.2h5.2V12H47v-1h2.5V9.9H47V9h2.8V7.8h-4.8v1Zm4.1 0L51.6 13h1.5l1.3-5.2h-1.5l-.7 2.9-.7-2.9h-1.6l1 1.6-.5 0Z"/>
        <circle cx="53" cy="4.6" r="2.6" fill="#C4B5FD" opacity="0.95"/>
      </svg>
    </div>
  )
}

export function PaymentMethodIcons({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 ${className}`}>
      <VisaIcon />
      <MastercardIcon />
      <ApplePayIcon />
      <GooglePayIcon />
    </div>
  )
}

export function PaymentMethodsSection() {
  const { language } = useLanguage()
  const isAr = language === "ar"

  return (
    <div className="pt-4">
      <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/85 font-bold">
        {isAr ? "طرق الدفع المدعومة" : "Secure Payment Methods"}
      </div>
      <PaymentMethodIcons className="justify-center" />
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80 font-medium">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" aria-hidden="true" />
        <span>
          {isAr
            ? "جميع عمليات الدفع مشفرة ومأمنة بالكامل — بوابة الدفع معتمدة ومتوافقة مع معايير الأمان العالمية (PCI-DSS)"
            : "All payments are fully encrypted and secured — PCI-DSS compliant payment gateway"}
        </span>
      </p>
    </div>
  )
}
