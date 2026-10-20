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
import { ShoppingCart, Package } from "lucide-react"
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
      await addToCartAction(itemId.toString(), "product")

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
                    <Image
                      src={item.imageUrl || "/placeholder.svg?height=200&width=300&query=product"}
                      alt={language === "ar" ? item.nameAr : item.nameEn}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="secondary">
                      {language === "ar" ? item.category_name_ar || "عام" : item.category_name_en || "General"}
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
                    {language === "ar" ? "المخزون:" : "Stock:"} {item.stockQuantity}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={() => handleAddToCart(item.id)} disabled={item.stockQuantity === 0}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {item.stockQuantity === 0 ? (language === "ar" ? "نفذ المخزون" : "Out of stock") : t("addToCart", language)}
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
