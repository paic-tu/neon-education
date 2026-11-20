import { z } from "zod"
import { renderSubscriptionSuccessEmail } from "@/lib/emails"
import type { SelectedEventAddOn } from "@/lib/event-add-ons"

export interface ReceiptData {
  id: string
  name: string
  totalAmount: string
  paidAt: Date | string
  paymentProvider: string | null
  items: { name: string; quantity: number; price: string; isEventTicket: boolean; selectedAddOns?: SelectedEventAddOn[] }[]
  ticketCount: number
}

export async function buildPaymentReceipt(data: ReceiptData, messageType: "receipt" | "tickets" = "receipt") {
  z.string().uuid().parse(data.id)
  const isEvent = data.items.some((item) => item.isEventTicket)
  const isTicketEmail = messageType === "tickets"
  if (isTicketEmail && (!isEvent || data.ticketCount < 1)) throw new Error("Event tickets are not ready")
  const url = isTicketEmail ? `https://neonedu.org/ar/tickets/${data.id}` : "https://neonedu.org/ar/orders"
  const amount = `${Number(data.totalAmount).toFixed(2)} ريال`
  const date = new Date(data.paidAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })
  const method = data.paymentProvider === "coupon" ? "قسيمة / طلب مجاني"
    : data.paymentProvider === "manual" ? "دفع أكدته الإدارة" : "Stream Pay"
  const title = isTicketEmail ? "تذاكر الفعالية ورابط الباركود - نيون" : "تم تأكيد الشراء - منصة نيون التعليمية"
  const items = data.items.filter((item) => !isTicketEmail || item.isEventTicket).map((item) => ({
    ...item, name: item.selectedAddOns?.length
      ? `${item.name} (${item.selectedAddOns.map((option) => `${option.nameAr}: ${option.price} ريال${option.noteAr || option.noteEn ? ` - ${option.noteAr || option.noteEn}` : ""}`).join(", ")})` : item.name,
  }))
  const rendered = await renderSubscriptionSuccessEmail({
    language: "ar",
    dashboardUrl: url,
    receipt: {
      userName: data.name, orderId: data.id, amount, paidAt: date, method,
      items, isEvent, ticketCount: data.ticketCount, messageType,
    },
  })
  return { subject: title, ...rendered, url }
}
