import { z } from "zod"
import { streamRequest } from "@/lib/payments/stream"

export interface PaymentOrder {
  id: string
  totalAmount: string
  paymentLinkId?: string | null
  invoiceId?: string | null
}

function cents(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const text = String(value)
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return null
  const amount = Number(text)
  const rounded = Math.round(amount * 100)
  return Number.isSafeInteger(rounded) && Math.abs(amount * 100 - rounded) < 0.001 ? rounded : null
}

export function verifyOrderInvoice(order: PaymentOrder, invoice: any) {
  if (!z.string().uuid().safeParse(invoice?.id).success) return null
  const linked = order.paymentLinkId
    ? invoice.payment_link_id === order.paymentLinkId
    : Boolean(order.invoiceId && invoice.id === order.invoiceId)
  const expected = cents(order.totalAmount)
  if (!linked || invoice.currency !== "SAR" || expected === null
    || cents(invoice.total_amount) !== expected) return null

  const payments = Array.isArray(invoice.payments) ? invoice.payments : []
  let paid = 0
  let refunded = 0
  let refundStatus = false
  let paymentId: string | null = null
  const seen = new Set<string>()
  for (const payment of payments) {
    if (!z.string().uuid().safeParse(payment.id).success || payment.currency !== "SAR" || seen.has(payment.id)) continue
    seen.add(payment.id)
    const amount = cents(payment.amount)
    const refund = cents(payment.amount_refunded ?? "0")
    if (amount === null || refund === null || refund > amount) return null
    const status = String(payment.current_status || "").toUpperCase()
    if (["SUCCEEDED", "SETTLED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(status)) {
      if (["REFUNDED", "PARTIALLY_REFUNDED"].includes(status)) refundStatus = true
      paid += amount
      refunded += refund
      paymentId = payment.id
    }
  }
  const invoiceRefund = cents(invoice.total_refunded ?? "0")
  if (invoiceRefund === null) return null
  const status = String(invoice.status || "").toUpperCase()
  const state = refundStatus || refunded > 0 || invoiceRefund > 0 ? "refunded"
    : ["CANCELED", "CANCELLED"].includes(status) ? "cancelled"
    : ["COMPLETED", "PAID"].includes(status) && paid >= expected && expected > 0 ? "paid"
    : "pending"
  return { state, invoiceId: invoice.id as string, paymentId, amount: order.totalAmount, currency: "SAR" as const }
}

type PaymentRequest = (path: string, init: RequestInit) => Promise<any>

export async function verifyOrderViaStream(order: PaymentOrder, hintInvoiceId?: string | null, request: PaymentRequest = streamRequest) {
  const candidates: string[] = []
  for (const id of [order.invoiceId, hintInvoiceId]) {
    if (id && z.string().uuid().safeParse(id).success && !candidates.includes(id)) candidates.push(id)
  }
  if (order.paymentLinkId && candidates.length === 0) {
    const list = await request(`/invoices?payment_link_id=${encodeURIComponent(order.paymentLinkId)}&limit=25`, { method: "GET" })
    const rows = Array.isArray(list) ? list : Array.isArray(list?.data) ? list.data : []
    for (const invoice of rows) {
      if (invoice.payment_link_id === order.paymentLinkId && z.string().uuid().safeParse(invoice.id).success) candidates.push(invoice.id)
    }
  }
  for (const id of candidates.slice(0, 25)) {
    const response = await request(`/invoices/${id}`, { method: "GET" })
    const proof = verifyOrderInvoice(order, response?.data ?? response)
    if (proof && proof.state !== "pending") return proof
  }
  return null
}
