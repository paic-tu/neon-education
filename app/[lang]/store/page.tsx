"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { NavBar } from "@/components/nav-bar"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { t } from "@/lib/i18n"
import { getAllStoreItems } from "@/lib/db/queries"
import { ShoppingCart, Package, Ticket, MapPin } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { addToCartAction } from "@/lib/actions/cart"

export default function StorePage() {
  const { language } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadItems = async () => {
      try {
        const data = await getAllStoreItems()
        setItems(data)
      } catch (error) {
        console.error("[v0] Error loading store items:", error)
      } finally {
        setLoading(false)
      }
    }

    loadItems()
  }, [])

  const handleAddToCart = async (itemId: string) => {
    if (!user) {
      router.push("/auth/login")
      return
    }

    try {
      const result = await addToCartAction(itemId.toString(), "product")
      if (result.error) throw new Error(result.error)

      toast({
        title: language === "ar" ? "تمت الإضافة" : "Added to cart",
        description: language === "ar" ? "تم إضافة المنتج للسلة" : "Product added to cart",
      })
    } catch (error) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل إضافة المنتج" : "Failed to add product",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="relative z-10 min-h-screen text-foreground">
        <NavBar />
        <main className="container mx-auto px-4 pt-24 pb-8 sm:pt-28">
          <div className="text-center py-16">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="relative z-10 min-h-screen text-foreground">
      <NavBar />
      <main className="container mx-auto px-4 pt-24 pb-8 sm:pt-28">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-foreground">{t("store", language)}</h1>
          <p className="text-foreground/75">
            {language === "ar" ? "احصل على منتجات منصة نيون" : "Get Neon products"}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">{language === "ar" ? "لا توجد منتجات" : "No products"}</h3>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <Card key={item.id} className="flex flex-col border-border/70 bg-card/95 text-card-foreground shadow-xl shadow-background/15 backdrop-blur-sm transition-shadow hover:shadow-2xl">
                <CardHeader>
                  <div className="relative h-48 w-full bg-muted rounded-lg overflow-hidden mb-4">
                    {item.imageUrl ? <Image
                      src={item.imageUrl}
                      alt={language === "ar" ? item.nameAr : item.nameEn}
                      fill
                      className="object-cover"
                    /> : <div className="flex h-full items-center justify-center bg-[#17374A] text-[#E09F48]">{item.productType === "event_ticket" ? <Ticket className="h-16 w-16" /> : <Package className="h-16 w-16" />}</div>}
                  </div>
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="secondary">
                      {item.productType === "event_ticket" ? (language === "ar" ? "تذكرة فعالية" : "Event Ticket") : (language === "ar" ? item.category?.nameAr || "عام" : item.category?.nameEn || "General")}
                    </Badge>
                    <div className="text-2xl font-bold text-primary">
                      {item.price} {language === "ar" ? "ر.س" : "SAR"}
                    </div>
                  </div>
                  <CardTitle className="text-xl text-foreground">{language === "ar" ? item.nameAr : item.nameEn}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-foreground/75">
                    {language === "ar" ? item.descriptionAr : item.descriptionEn}
                  </p>
                  {item.points_cost && (
                    <p className="mt-2 text-sm font-semibold text-primary">
                      {language === "ar" ? "أو" : "Or"} {item.points_cost} {t("points", language)}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-foreground/70">
                    {item.productType === "event_ticket" ? (language === "ar" ? "التذاكر المتاحة:" : "Available tickets:") : (language === "ar" ? "المخزون:" : "Stock:")} {item.availableQuantity ?? item.stockQuantity}
                  </p>
                  {item.productType === "event_ticket" && <div className="mt-3 space-y-2 text-sm text-muted-foreground"><p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{item.eventLocation}</p><p>{new Date(item.eventStartsAt).toLocaleString(language === "ar" ? "ar-SA" : "en-GB")}</p><p>{language === "ar" ? "تذكرة QR خاصة بعد تأكيد الدفع" : "Private QR ticket after payment confirmation"}</p></div>}
                </CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={() => handleAddToCart(item.id)} disabled={(item.availableQuantity ?? item.stockQuantity) === 0 || (item.productType === "event_ticket" && new Date(item.eventEndsAt) < new Date())}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {item.productType === "event_ticket" && new Date(item.eventEndsAt) < new Date() ? (language === "ar" ? "انتهت الفعالية" : "Event ended") : (item.availableQuantity ?? item.stockQuantity) === 0 ? (language === "ar" ? "نفذ المخزون" : "Out of stock") : t("addToCart", language)}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
