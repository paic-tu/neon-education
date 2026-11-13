import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { verifyOrderInvoice, verifyOrderViaStream } from "../lib/payments/verify-order"

const order = { id: randomUUID(), totalAmount: "1.00", paymentLinkId: randomUUID(), invoiceId: null }
const paidInvoice = () => ({
  id: randomUUID(), payment_link_id: order.paymentLinkId, currency: "SAR", total_amount: "1.000", status: "COMPLETED",
  payments: [{ id: randomUUID(), currency: "SAR", amount: "1.000", amount_refunded: "0.000", current_status: "SUCCEEDED" }],
})

test("تأكيد فاتورة مدفوعة ومربوطة بالطلب الصحيح", () => {
  assert.equal(verifyOrderInvoice(order, paidInvoice())?.state, "paid")
})
test("حالة الفاتورة وحدها لا تكفي لإثبات الدفع", () => {
  const invoice = paidInvoice()
  invoice.payments[0].current_status = "PENDING"
  assert.equal(verifyOrderInvoice(order, invoice)?.state, "pending")
})
test("رفض فاتورة طلب آخر حتى لو كانت مدفوعة بنفس المبلغ", () => {
  const invoice = paidInvoice()
  invoice.payment_link_id = randomUUID()
  assert.equal(verifyOrderInvoice(order, invoice), null)
})
test("رفض مبلغ أو عملة غير مطابقين", () => {
  const invoice = paidInvoice()
  invoice.total_amount = "2.000"
  assert.equal(verifyOrderInvoice(order, invoice), null)
  invoice.total_amount = "1.000"
  invoice.currency = "USD"
  assert.equal(verifyOrderInvoice(order, invoice), null)
})
test("رفض مبالغ مدفوعة أقل من قيمة الطلب", () => {
  const invoice = paidInvoice()
  invoice.payments[0].amount = "0.500"
  assert.equal(verifyOrderInvoice(order, invoice)?.state, "pending")
})
test("استرداد الدفع لا يتحول إلى قبول جديد", () => {
  const invoice = paidInvoice()
  invoice.payments[0].amount_refunded = "1.000"
  assert.equal(verifyOrderInvoice(order, invoice)?.state, "refunded")
})
test("التحقق يجلب تفاصيل الفاتورة من API ولا يثق بقائمة النتائج", async () => {
  const invoice = paidInvoice()
  const calls: string[] = []
  const result = await verifyOrderViaStream(order, null, async (path) => {
    calls.push(path)
    return path.startsWith("/invoices?") ? { data: [{ id: invoice.id, payment_link_id: order.paymentLinkId }] } : invoice
  })
  assert.equal(result?.state, "paid")
  assert.equal(calls.length, 2)
})
test("تجاهل الفواتير غير المرتبطة عند تجاهل البوابة لمرشح البحث", async () => {
  let calls = 0
  const result = await verifyOrderViaStream(order, null, async () => {
    calls++
    return { data: [{ ...paidInvoice(), payment_link_id: randomUUID() }] }
  })
  assert.equal(result, null)
  assert.equal(calls, 1)
})
test("تكرار عملية واحدة في الرد لا يضاعف المبلغ المدفوع", () => {
  const invoice = paidInvoice()
  invoice.payments[0].amount = "0.500"
  invoice.payments.push({ ...invoice.payments[0] })
  assert.equal(verifyOrderInvoice(order, invoice)?.state, "pending")
})
