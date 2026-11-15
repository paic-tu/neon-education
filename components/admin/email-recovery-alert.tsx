import React from "react"
import { getEmailRecoveryHealth } from "@/lib/payments/email-recovery"
import type { Connection } from "@/lib/payments/payment-notifications"

export async function renderEmailRecoveryAlert({ lang }: { lang: string }, connection?: Connection) {
  const ar = lang === "ar"
  let health
  try {
    health = await getEmailRecoveryHealth(connection)
  } catch {
    return <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      {ar ? "تعذر فحص خدمة الإيصالات. تأكد من تطبيق تحديث قاعدة البيانات." : "Receipt monitoring is unavailable. Check the database migration."}
    </div>
  }
  if (!health.stale && health.domainStatus === "verified" && !health.monitorError && !health.pending && !health.deliveryIssues && !health.review) return null
  return (
    <div role="alert" className="space-y-1 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <p className="font-semibold">{ar ? "تنبيه خدمة إيصالات الدفع" : "Payment Receipt Alert"}</p>
      {health.stale && <p>{ar ? "مهمة إعادة الإرسال غير مفعّلة أو لم تعمل خلال آخر 15 دقيقة." : "Recovery is not configured or has not run in the last 15 minutes."}</p>}
      {health.domainStatus !== "verified" && <p>{ar ? "لم تؤكد المراقبة سلامة نطاق الإرسال. تحقق من Resend وDNS." : "Sending domain health is not confirmed. Check Resend and DNS."}</p>}
      {health.monitorError && <p>{ar ? "واجهت مهمة مراقبة البريد خطأ. راجع سجل السيرفر وتنبيهات المجدول." : "Email monitoring encountered an error. Check server logs and scheduler alerts."}</p>}
      {health.pending > 0 && <p>{ar ? `إيصالات تنتظر الإرسال: ${health.pending}.` : `Receipts awaiting sending: ${health.pending}.`}</p>}
      {health.deliveryIssues > 0 && <p>{ar ? `رسائل متعثرة أو غير مؤكدة التسليم: ${health.deliveryIssues}. لا تعاد الرسائل المرتدة تلقائيًا.` : `Failed or unconfirmed deliveries: ${health.deliveryIssues}. Bounced messages are not resent automatically.`}</p>}
      {health.review > 0 && <p>{ar ? `محاولات تحتاج مراجعة قبل إعادة الإرسال لمنع التكرار: ${health.review}.` : `Attempts requiring review before resending to prevent duplicates: ${health.review}.`}</p>}
    </div>
  )
}
