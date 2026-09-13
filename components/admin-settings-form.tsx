"use client"

import * as React from "react"
import { useLanguage } from "@/lib/language-context"
import { useFormState, useFormStatus } from "react-dom"
import { KeyRound, Copy, Check, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react"
import { saveSettingsAction } from "@/lib/actions/settings"

type SettingsFormProps = {
  initial: {
    siteName: string
    supportEmail: string
    maintenanceMode: boolean
    allowRegistration: boolean
    currency: string
    email: {
      smtpHost?: string
      smtpPort?: number
      smtpUser?: string
      smtpPassword?: string
      notifications?: boolean
    }
    features: {
      showStore?: boolean
      showMentors?: boolean
      enableLive?: boolean
    }
  }
}

function generateSecureString(length: number, alphabet: string) {
  const arr = new Uint8Array(length)
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(arr)
  } else {
    for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 256)
  }
  let out = ""
  for (let i = 0; i < length; i++) out += alphabet[arr[i] % alphabet.length]
  return out
}

function generateSmtpPassword() {
  return generateSecureString(
    24,
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*_+-="
  )
}

function generateWebhookSecret() {
  return "whsec_" + generateSecureString(32, "abcdefghijklmnopqrstuvwxyz0123456789")
}

function generateStreamApiKey() {
  const raw = generateSecureString(32, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
  if (typeof Buffer !== "undefined") {
    return "stream_live_" + Buffer.from(raw).toString("base64url")
  }
  const b64 = btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  return "stream_live_" + b64
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {label}...
        </>
      ) : (
        label
      )}
    </button>
  )
}

function KeyGenInput({
  id,
  label,
  description,
  defaultValue = "",
  placeholder,
  generator,
  type = "password",
  suffixButton,
}: {
  id: string
  label: string
  description?: string
  defaultValue?: string
  placeholder?: string
  generator: () => string
  type?: "text" | "password"
  suffixButton?: React.ReactNode
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [visible, setVisible] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const generate = () => {
    if (!inputRef.current) return
    inputRef.current.value = generator()
    inputRef.current.dispatchEvent(new Event("input", { bubbles: true }))
    inputRef.current.focus()
  }

  const copy = async () => {
    if (!inputRef.current) return
    try {
      await navigator.clipboard.writeText(inputRef.current.value || "")
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  const actualType = type === "password" && !visible ? "password" : "text"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      </div>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            id={id}
            name={id}
            type={actualType}
            defaultValue={defaultValue}
            placeholder={placeholder}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-24 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <div className="absolute inset-y-0 right-1 flex items-center gap-0.5 pr-1">
            {type === "password" ? (
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                title={visible ? "إخفاء" : "إظهار"}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground transition-colors"
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={copy}
              title="نسخ"
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={generate}
          title="توليد مفتاح جديد آلياً"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:-translate-y-0.5 shadow-sm transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          <KeyRound className="h-4 w-4" />
          <span>Generate</span>
        </button>
        {suffixButton}
      </div>
    </div>
  )
}

export function AdminSettingsForm({ initial }: SettingsFormProps) {
  const { language } = useLanguage()
  const isAr = language === "ar"

  const [state, action] = useFormState(saveSettingsAction, undefined)
  const [toast, setToast] = React.useState<{ ok: boolean; msg: string } | null>(null)

  React.useEffect(() => {
    if (!state) return
    if (state.ok) {
      setToast({ ok: true, msg: isAr ? "✅ تم حفظ الإعدادات بنجاح" : "✅ Settings saved successfully" })
    } else {
      setToast({ ok: false, msg: isAr ? `❌ فشل الحفظ: ${state.error || "خطأ غير معروف"}` : `❌ Save failed: ${state.error || "Unknown error"}` })
    }
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [state, isAr])

  return (
    <form action={action} className="space-y-8">
      {toast ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-medium shadow-sm ${
            toast.ok
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          }`}
        >
          {toast.msg}
        </div>
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-xl border bg-card p-6 shadow-sm">
        <div className="md:col-span-2 space-y-1">
          <h2 className="text-lg font-semibold">
            {isAr ? "إعدادات عامة" : "General Settings"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAr ? "بيانات أساسية للمنصة" : "Basic platform information"}
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="siteName" className="text-sm font-medium">{isAr ? "اسم الموقع" : "Site Name"}</label>
          <input
            id="siteName"
            name="siteName"
            defaultValue={initial.siteName || ""}
            placeholder="Neon Edu"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="supportEmail" className="text-sm font-medium">{isAr ? "بريد الدعم" : "Support Email"}</label>
          <input
            id="supportEmail"
            name="supportEmail"
            type="email"
            defaultValue={initial.supportEmail || ""}
            placeholder="support@neon.edu"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="currency" className="text-sm font-medium">{isAr ? "العملة الافتراضية" : "Default Currency"}</label>
          <select
            id="currency"
            name="currency"
            defaultValue={initial.currency || "SAR"}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="SAR">SAR — {isAr ? "ريال سعودي" : "Saudi Riyal"}</option>
            <option value="USD">USD — {isAr ? "دولار أمريكي" : "US Dollar"}</option>
            <option value="AED">AED — {isAr ? "درهم إماراتي" : "UAE Dirham"}</option>
            <option value="EGP">EGP — {isAr ? "جنيه مصري" : "Egyptian Pound"}</option>
          </select>
        </div>

        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 rounded-lg border border-input bg-background/40 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <input
              type="checkbox"
              name="maintenanceMode"
              defaultChecked={Boolean(initial.maintenanceMode)}
              className="h-4 w-4 rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <div className="text-sm font-medium">{isAr ? "وضع الصيانة" : "Maintenance Mode"}</div>
              <div className="text-xs text-muted-foreground">
                {isAr ? "تعطيل الواجهة لغير الأدمن" : "Disable frontend for non-admins"}
              </div>
            </div>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-input bg-background/40 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <input
              type="checkbox"
              name="allowRegistration"
              defaultChecked={Boolean(initial.allowRegistration)}
              className="h-4 w-4 rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <div className="text-sm font-medium">{isAr ? "السماح بالتسجيل" : "Allow Registration"}</div>
              <div className="text-xs text-muted-foreground">
                {isAr ? "تسجيل حسابات جديدة" : "New sign-ups enabled"}
              </div>
            </div>
          </label>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-xl border bg-card p-6 shadow-sm">
        <div className="md:col-span-2 space-y-1">
          <h2 className="text-lg font-semibold">{isAr ? "إعدادات البريد (SMTP)" : "Email Settings (SMTP)"}</h2>
          <p className="text-sm text-muted-foreground">
            {isAr ? "اعدادات خادم البريد لإرسال رسائل النظام" : "SMTP server for system emails"}
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="smtpHost" className="text-sm font-medium">{isAr ? "المضيف (Host)" : "SMTP Host"}</label>
          <input
            id="smtpHost"
            name="smtpHost"
            defaultValue={initial.email?.smtpHost || ""}
            placeholder="smtp.example.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="smtpPort" className="text-sm font-medium">{isAr ? "المنفذ (Port)" : "SMTP Port"}</label>
          <input
            id="smtpPort"
            name="smtpPort"
            type="number"
            defaultValue={initial.email?.smtpPort ?? 587}
            placeholder="587"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="smtpUser" className="text-sm font-medium">{isAr ? "اسم المستخدم" : "Username"}</label>
          <input
            id="smtpUser"
            name="smtpUser"
            defaultValue={initial.email?.smtpUser || ""}
            placeholder="noreply@neon.edu"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <KeyGenInput
          id="smtpPassword"
          label={isAr ? "كلمة مرور SMTP" : "SMTP Password"}
          description={isAr ? "24 حرف قوي يحتوي علامات خاصة" : "24-char strong password with symbols"}
          defaultValue={initial.email?.smtpPassword || ""}
          placeholder="••••••••••••••"
          generator={generateSmtpPassword}
          type="password"
        />

        <div className="md:col-span-2">
          <label className="flex items-center gap-3 rounded-lg border border-input bg-background/40 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <input
              type="checkbox"
              name="emailNotifications"
              defaultChecked={Boolean(initial.email?.notifications)}
              className="h-4 w-4 rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <div className="text-sm font-medium">{isAr ? "تفعيل إشعارات البريد" : "Enable Email Notifications"}</div>
              <div className="text-xs text-muted-foreground">
                {isAr ? "إرسال تحديثات للمستخدمين عبر البريد" : "Send updates to users via email"}
              </div>
            </div>
          </label>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-xl border bg-card p-6 shadow-sm">
        <div className="md:col-span-2 space-y-1">
          <h2 className="text-lg font-semibold">{isAr ? "أدوات المطور (Stream Pay & Webhooks)" : "Developer Tools (Stream Pay & Webhooks)"}</h2>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "المفاتيح الخاصة بوابة الدفع والويبهوك — انسخها إلى ملف البيئة أو الإعدادات"
              : "Gateway & webhook secrets — copy these into your env file or settings"}
          </p>
        </div>

        <KeyGenInput
          id="STREAM_API_KEY_BASE64"
          label="Stream API Key (Base64)"
          description={isAr ? "مفتاح صالح بتنسيق base64url صالح للاستخدام" : "Valid base64url-encoded key"}
          placeholder="stream_live_..."
          generator={generateStreamApiKey}
          type="text"
        />

        <KeyGenInput
          id="STREAM_WEBHOOK_SECRET"
          label="Stream Webhook Secret"
          description={isAr ? "كلمة سر توقيع طلبات الويبهوك" : "Signing secret for webhook requests"}
          placeholder="whsec_..."
          generator={generateWebhookSecret}
          type="password"
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="md:col-span-3 space-y-1 mb-2">
          <h2 className="text-lg font-semibold">{isAr ? "الميزات" : "Features"}</h2>
          <p className="text-sm text-muted-foreground">
            {isAr ? "عرض وإخفاء أقسام الموقع" : "Show/hide site sections"}
          </p>
        </div>
        <label className="flex items-center gap-3 rounded-lg border border-input bg-background/40 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
          <input
            type="checkbox"
            name="showStore"
            defaultChecked={Boolean(initial.features?.showStore)}
            className="h-4 w-4 rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <div className="text-sm font-medium">{isAr ? "عرض المتجر" : "Show Store"}</div>
            <div className="text-xs text-muted-foreground">/store</div>
          </div>
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-input bg-background/40 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
          <input
            type="checkbox"
            name="showMentors"
            defaultChecked={Boolean(initial.features?.showMentors)}
            className="h-4 w-4 rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <div className="text-sm font-medium">{isAr ? "عرض صفحة المرشدين" : "Show Mentors"}</div>
            <div className="text-xs text-muted-foreground">/mentors</div>
          </div>
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-input bg-background/40 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
          <input
            type="checkbox"
            name="enableLive"
            defaultChecked={Boolean(initial.features?.enableLive)}
            className="h-4 w-4 rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <div className="text-sm font-medium">{isAr ? "الجلسات المباشرة" : "Live Sessions"}</div>
            <div className="text-xs text-muted-foreground">/live</div>
          </div>
        </label>
      </section>

      <div className="flex items-center justify-end">
        <SubmitButton label={isAr ? "حفظ الإعدادات" : "Save Settings"} />
      </div>
    </form>
  )
}
