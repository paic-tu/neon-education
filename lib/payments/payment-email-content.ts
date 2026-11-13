import { z } from "zod"

export interface ReceiptData {
  id: string
  name: string
  totalAmount: string
  paidAt: Date | string
  paymentProvider: string | null
  items: { name: string; quantity: number; price: string; isEventTicket: boolean }[]
  ticketCount: number
}

function escapeHtml(value: unknown) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]!))
}

export function buildPaymentReceipt(data: ReceiptData) {
  z.string().uuid().parse(data.id)
  const isEvent = data.items.some((item) => item.isEventTicket)
  const url = isEvent ? `https://neonedu.org/ar/tickets/${data.id}` : "https://neonedu.org/ar/orders"
  const amount = `${Number(data.totalAmount).toFixed(2)} ريال`
  const date = new Date(data.paidAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })
  const method = data.paymentProvider === "coupon" ? "قسيمة / طلب مجاني"
    : data.paymentProvider === "manual" ? "دفع أكدته الإدارة" : "Stream Pay"
  const title = "تم تأكيد الدفع - منصة نيون التعليمية"
  const button = isEvent ? "عرض تذاكري والباركود" : "عرض طلباتي"
  const warning = isEvent
    ? "يتطلب الرابط تسجيل الدخول بالحساب الذي اشترى التذاكر. لا تشارك الباركود؛ كل تذكرة تسمح بدخول واحد فقط."
    : "يمكنك مراجعة تفاصيل الطلب بعد تسجيل الدخول إلى حسابك في نيون."
  const summary = data.items.map((item) => `${item.name} × ${item.quantity}`).join("\n")
  const text = [
    `مرحباً ${data.name}،`, "تم تأكيد الدفع لطلبك في منصة نيون التعليمية.",
    `رقم الطلب: ${data.id}`, `المبلغ: ${amount}`, `تاريخ التأكيد (السعودية): ${date}`,
    `طريقة التأكيد: ${method}`, summary,
    ...(isEvent ? [`عدد التذاكر: ${data.ticketCount}`] : []),
    `${button}: ${url}`, warning,
  ].join("\n\n")
  const rows = data.items.map((item) => `<tr><td style="padding:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.name)}</td><td style="padding:12px;border-bottom:1px solid #e2e8f0">${item.quantity}</td><td style="padding:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.price)} ريال</td></tr>`).join("")
  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"></head><body style="margin:0;background:#f1f5f9;font-family:Tahoma,Arial,sans-serif;color:#17374A">
    <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden">
      <div style="background:#17374A;padding:28px;color:#fff"><h1 style="font-size:24px;margin:0">منصة نيون التعليمية</h1><p style="color:#E09F48;margin-bottom:0">تأكيد الدفع وملخص الطلب</p></div>
      <div style="padding:28px;line-height:1.9"><h2 style="font-size:20px">تم تأكيد الدفع بنجاح</h2><p>مرحباً ${escapeHtml(data.name)}، تم تأكيد طلبك.</p>
        <p><strong>المبلغ:</strong> ${escapeHtml(amount)}<br><strong>طريقة التأكيد:</strong> ${escapeHtml(method)}<br><strong>وقت التأكيد:</strong> ${escapeHtml(date)}</p>
        <p style="font-size:12px">رقم الطلب: <span dir="ltr">${escapeHtml(data.id)}</span></p>
        <table style="width:100%;border-collapse:collapse;text-align:right"><thead><tr style="background:#f1f5f9"><th style="padding:12px">المنتج أو الدورة</th><th style="padding:12px">العدد</th><th style="padding:12px">سعر الوحدة</th></tr></thead><tbody>${rows}</tbody></table>
        ${isEvent ? `<p><strong>تذاكر الفعالية:</strong> ${data.ticketCount} تذكرة. الباركود الخاص بكل تذكرة متاح داخل نيون.</p>` : ""}
        <p style="text-align:center;margin:28px 0"><a href="${url}" style="display:inline-block;padding:12px 24px;background:#2F5257;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">${button}</a></p>
        <p style="font-size:13px;color:#475569">${warning}</p><p style="font-size:12px;word-break:break-all"><a href="${url}" style="color:#2F5257">${url}</a></p>
      </div>
    </div></body></html>`
  return { subject: title, text, html, url }
}
