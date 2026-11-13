"use server"

import { auth } from "@/lib/auth"
import { getUserOrders } from "@/lib/db/queries"
import { after } from "next/server"
import { retryBuyerPaymentReceipts } from "@/lib/payments/payment-notifications"

export async function getUserOrdersAction() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return []
    }
    const orders = await getUserOrders(session.user.id)
    // لا نؤخر عرض الطلبات بانتظار خدمة البريد، ولا نعيد الإيصالات التي سبق إرسالها.
    after(async () => {
      await retryBuyerPaymentReceipts(session.user.id).catch(() => {
        console.error("Failed to retry buyer payment receipts")
      })
    })
    return orders
  } catch (error) {
    console.error("Error fetching user orders:", error)
    return []
  }
}
