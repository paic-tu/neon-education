import { z } from "zod"
import { renderSubscriptionSuccessEmail } from "@/lib/emails"

export interface ReceiptData {
  id: string
  name: string
  totalAmount: string
  paidAt: Date | string
  paymentProvider: string | null
  items: { name: string; quantity: number; price: string; isEventTicket: boolean }[]
  ticketCount: number
}

export async function buildPaymentReceipt(data: ReceiptData) {
  z.string().uuid().parse(data.id)
  const isEvent = data.items.some((item) => item.isEventTicket)
  const url = isEvent ? `https://neonedu.org/ar/tickets/${data.id}` : "https://neonedu.org/ar/orders"
  const amount = `${Number(data.totalAmount).toFixed(2)} ريال`
  const date = new Date(data.paidAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })
  const method = data.paymentProvider === "coupon" ? "قسيمة / طلب مجاني"
    : data.paymentProvider === "manual" ? "دفع أكدته الإدارة" : "Stream Pay"
  const title = "تم تأكيد الدفع - منصة نيون التعليمية"
  const rendered = await renderSubscriptionSuccessEmail({
    language: "ar",
    dashboardUrl: url,
    receipt: {
      userName: data.name, orderId: data.id, amount, paidAt: date, method,
      items: data.items, isEvent, ticketCount: data.ticketCount,
    },
  })
  return { subject: title, ...rendered, url }
}
