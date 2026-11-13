"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/lib/language-context"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Trash2, ShoppingCart, CreditCard, ShieldCheck, Truck } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { removeFromCartAction, validateCouponAction, checkoutAction } from "@/lib/actions"
import Link from "next/link"

interface CartItem {
  id: string
  course?: {
    id: string
    titleEn: string
    titleAr: string
    price: string
    thumbnailUrl: string | null
  } | null
  product?: {
    id: string
    nameEn: string
    nameAr: string
    price: string
    imageUrl: string | null
    productType?: string
  } | null
  quantity: number
}

interface CartClientProps {
  initialCart: {
    id: string
    items: CartItem[]
  } | null
}

export function CartClient({ initialCart }: CartClientProps) {
  const router = useRouter()
  const { language } = useLanguage()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const isAr = language === "ar"
  const [couponInput, setCouponInput] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string
    name: string
    isPercentage: boolean
    discountValue: number
    currency: string
  } | null>(null)
  
  const items = initialCart?.items || []
  const hasEventTickets = items.some((item) => item.product?.productType === "event_ticket")
  const hasCourses = items.some((item) => Boolean(item.course))
  const itemsCount = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)
  
  const subtotal = items.reduce((acc, item) => {
    const price = item.course ? parseFloat(item.course.price) : item.product ? parseFloat(item.product.price) : 0
    const qty = Number(item.quantity) || 1
    return acc + price * qty
  }, 0)

  const discount = useMemo(() => {
    if (!appliedCoupon) return 0
    if (!Number.isFinite(subtotal) || subtotal <= 0) return 0
    const dv = Number(appliedCoupon.discountValue) || 0
    if (dv <= 0) return 0
    const raw = appliedCoupon.isPercentage ? subtotal * (dv / 100) : dv
    const capped = Math.max(0, Math.min(subtotal, raw))
    return Number(capped.toFixed(2))
  }, [appliedCoupon, subtotal])

  const total = Math.max(0, Number((subtotal - discount).toFixed(2)))

  const formatMoney = (value: number) => {
    const v = Number.isFinite(value) ? value : 0
    return `${v.toFixed(2)} ${isAr ? "ر.س" : "SAR"}`
  }

  const handleRemove = (itemId: string) => {
    startTransition(async () => {
      const result = await removeFromCartAction(itemId)
      if (result.success) {
        toast({
          title: isAr ? "تم الحذف" : "Removed",
          description: isAr ? "تم حذف العنصر من السلة" : "Item removed from cart",
        })
        router.refresh()
      } else {
        toast({
          variant: "destructive",
          title: isAr ? "خطأ" : "Error",
          description: result.error || (isAr ? "فشل حذف العنصر" : "Failed to remove item"),
        })
      }
    })
  }

  const handleCheckout = () => {
    startTransition(async () => {
      const couponIds = appliedCoupon?.id ? [appliedCoupon.id] : null
      const result = await checkoutAction(undefined, undefined, language, couponIds)
      if (result.success) {
        if ((result as any).checkoutUrl) {
          toast({
            title: isAr ? "جاري تحويلك للدفع" : "Redirecting to payment",
            description: isAr ? "سيتم فتح صفحة الدفع الآمنة" : "Opening secure checkout",
          })
          window.location.href = (result as any).checkoutUrl
          return
        }

        toast({
          title: isAr ? "تم الطلب بنجاح" : "Order Placed",
          description: hasEventTickets
            ? (isAr ? "تم تأكيد حجز الفعالية. يمكنك عرض تذاكرك والباركود من صفحة التذاكر." : "Your event booking is confirmed. View your tickets and barcodes on the tickets page.")
            : hasCourses
              ? (isAr ? "تم إنشاء طلبك وتفعيل الدورات" : "Your order has been placed and courses activated")
              : (isAr ? "تم إنشاء طلبك. يمكنك مراجعة التفاصيل في طلباتي." : "Your order has been placed. View the details in My Orders."),
        })
        if (result.receiptSent === false) {
          toast({
            variant: "destructive",
            title: isAr ? "تعذر إرسال الإيصال" : "Receipt could not be sent",
            description: isAr ? "تم تأكيد طلبك. افتح طلباتي لعرض التفاصيل وإعادة محاولة إرسال الإيصال." : "Your order is confirmed. Open My Orders to view the details and retry the receipt.",
          })
        }
        router.refresh()
        router.push(hasEventTickets && result.orderId
          ? `/${language}/tickets/${result.orderId}`
          : hasCourses ? `/${language}/student/dashboard` : `/${language}/orders`)
      } else {
        toast({
          variant: "destructive",
          title: isAr ? "خطأ" : "Error",
          description: result.error || (isAr ? "فشل إتمام الشراء" : "Checkout failed"),
        })
      }
    })
  }

  const applyCoupon = () => {
    startTransition(async () => {
      const code = couponInput.trim()
      if (!code) {
        toast({
          variant: "destructive",
          title: isAr ? "خطأ" : "Error",
          description: isAr ? "أدخل كود الخصم" : "Enter a coupon code",
        })
        return
      }
      const res = await validateCouponAction(code)
      if ((res as any).success && (res as any).coupon?.id) {
        setAppliedCoupon((res as any).coupon)
        toast({ title: isAr ? "تم تطبيق الكوبون" : "Coupon applied" })
        return
      }
      toast({
        variant: "destructive",
        title: isAr ? "خطأ" : "Error",
        description: (res as any).error || (isAr ? "كود غير صالح" : "Invalid coupon"),
      })
    })
  }

  if (items.length === 0) {
    return (
      <div className="relative z-10 min-h-screen bg-background" dir={isAr ? "rtl" : "ltr"}>
        <div className="container mx-auto px-4 pt-28 pb-10 sm:pt-32">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>{isAr ? "سلة المشتريات" : "Shopping Cart"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <ShoppingCart className="h-20 w-20 text-muted-foreground/50" />
              <div className="text-xl font-semibold">{isAr ? "سلتك فارغة" : "Your cart is empty"}</div>
              <div className="text-sm text-muted-foreground">
                {isAr ? "ابدأ بإضافة دورة أو منتج للمتابعة إلى الدفع." : "Add a course or product to proceed to checkout."}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={`/${language}/courses`}>{isAr ? "تصفح الدورات" : "Browse Courses"}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/${language}/store`}>{isAr ? "تصفح المتجر" : "Browse Store"}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="relative z-10 min-h-screen bg-background" dir={isAr ? "rtl" : "ltr"}>
      <div className="container mx-auto px-4 pt-28 pb-24 sm:pt-32 lg:pb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">{isAr ? "سلة المشتريات" : "Shopping Cart"}</h1>
            <div className="text-sm text-muted-foreground">
              {isAr ? `${itemsCount} عنصر` : `${itemsCount} item(s)`} • {formatMoney(total)}
            </div>
            <div className="max-w-sm">
              <Progress value={33} />
              <div className="mt-1 text-xs text-muted-foreground">
                {isAr ? "الخطوة 1 من 3: راجع السلة ثم انتقل للدفع." : "Step 1 of 3: Review cart then checkout."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{isAr ? "1) السلة" : "1) Cart"}</Badge>
            <Badge variant="secondary">{isAr ? "2) الدفع" : "2) Payment"}</Badge>
            <Badge variant="secondary">{isAr ? "3) التأكيد" : "3) Done"}</Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-3">
          {items.map((item) => {
            // Safety check for missing product/course data
            if (!item.course && !item.product) return null

            const title = item.course 
              ? (language === "ar" ? item.course.titleAr : item.course.titleEn)
              : (language === "ar" ? item.product?.nameAr : item.product?.nameEn) || "Unknown Item"
            
            const price = item.course 
              ? item.course.price 
              : item.product?.price || "0"
              
            const image = item.course?.thumbnailUrl || item.product?.imageUrl
            const unit = Number.parseFloat(price) || 0
            const typeLabel = item.course ? (isAr ? "دورة" : "Course") : (isAr ? "منتج" : "Product")
            const href = item.course ? `/${language}/courses/${item.course.id}` : `/${language}/store`

            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="relative h-32 w-full sm:h-24 sm:w-32 bg-muted rounded-lg overflow-hidden shrink-0">
                      {image ? (
                        <Image src={image} alt={title} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">{isAr ? "بدون صورة" : "No image"}</div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1.5">
                          <Badge variant="secondary" className="text-xs font-normal">{typeLabel}</Badge>
                          <Link
                            className="block font-semibold text-base leading-snug text-foreground line-clamp-2 hover:text-primary hover:underline sm:text-lg"
                            href={href}
                          >
                            {title}
                          </Link>
                        </div>
                        <div className="shrink-0 text-end">
                          <div className="text-lg font-bold text-foreground">{formatMoney(unit)}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end border-t border-border pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleRemove(item.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                          {isAr ? "إزالة من السلة" : "Remove from cart"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          </div>

          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle>{isAr ? "ملخص الطلب" : "Order Summary"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                    <div className="text-sm font-semibold">{isAr ? "كود الخصم" : "Coupon"}</div>
                    <div className="flex gap-2">
                      <Input
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder={isAr ? "مثال: SAVE10" : "e.g. SAVE10"}
                        className="h-9"
                        dir="ltr"
                        disabled={isPending}
                      />
                      <Button className="h-9" variant="outline" onClick={applyCoupon} disabled={isPending}>
                        {isAr ? "تطبيق" : "Apply"}
                      </Button>
                    </div>
                    {appliedCoupon && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-muted-foreground">
                          {isAr ? "مطبق:" : "Applied:"} {appliedCoupon.name}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setAppliedCoupon(null)}
                          disabled={isPending}
                        >
                          {isAr ? "إزالة" : "Remove"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{isAr ? "المجموع الفرعي" : "Subtotal"}</span>
                      <span>{formatMoney(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{isAr ? "الخصم" : "Discount"}</span>
                      <span>- {formatMoney(discount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{isAr ? "الشحن" : "Shipping"}</span>
                      <span>{formatMoney(0)}</span>
                    </div>
                  </div>

                  <div className="rounded-md border bg-muted/20 p-3">
                    <div className="flex items-center justify-between font-semibold">
                      <span>{isAr ? "الإجمالي" : "Total"}</span>
                      <span>{formatMoney(total)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {isAr ? "الدفع يتم عبر بوابة دفع آمنة." : "Secure checkout via payment gateway."}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button className="w-full gap-2" size="lg" onClick={handleCheckout} disabled={isPending}>
                    <CreditCard className="h-4 w-4" />
                    {isPending ? (isAr ? "جاري المعالجة..." : "Processing...") : isAr ? "إتمام الشراء" : "Checkout"}
                  </Button>
                  <Button className="w-full" variant="outline" asChild disabled={isPending}>
                    <Link href={`/${language}/courses`}>{isAr ? "متابعة التسوق" : "Continue shopping"}</Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <div>{isAr ? "دفع آمن ومشفّر" : "Secure encrypted payment"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    <div>{hasEventTickets
                      ? (isAr ? "تذاكر الفعالية والباركود متاحة بعد تأكيد الدفع" : "Event tickets and barcodes are available after payment confirmation")
                      : hasCourses
                        ? (isAr ? "تفعيل فوري للدورات بعد الدفع" : "Instant course activation after payment")
                        : (isAr ? "متابعة طلبك بعد تأكيد الدفع" : "Track your order after payment confirmation")}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{isAr ? "الإجمالي" : "Total"}</div>
            <div className="font-semibold truncate">{formatMoney(total)}</div>
          </div>
          <Button className="gap-2 shrink-0" onClick={handleCheckout} disabled={isPending}>
            <CreditCard className="h-4 w-4" />
            {isPending ? (isAr ? "..." : "...") : isAr ? "الدفع" : "Pay"}
          </Button>
        </div>
      </div>
    </div>
  )
}
