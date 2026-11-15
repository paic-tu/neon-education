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
import { ShoppingCart, Package, Ticket, MapPin, CreditCard, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { addToCartAction } from "@/lib/actions/cart"

type CatalogItem = Awaited<ReturnType<typeof getAllStoreItems>>[number]

export function ProductCatalog({ catalog }: { catalog: "store" | "events" }) {
  const { language } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addingToCart, setAddingToCart] = useState<string | null>(null)
  const isEvents = catalog === "events"
  const isAr = language === "ar"
  const EmptyIcon = isEvents ? Ticket : Package

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const loadItems = async () => {
      try {
        const data = await getAllStoreItems(catalog)
        if (!cancelled) setItems(data)
      } catch (error) {
        console.error("Error loading catalog:", error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadItems()
    return () => { cancelled = true }
  }, [catalog])

  const handleAddToCart = async (itemId: string, goToCart = false) => {
    if (!user) {
      router.push(`/${language}/auth/login?callbackUrl=/${language}/${catalog}`)
      return
    }
    if (addingToCart) return
    setAddingToCart(itemId)
    try {
      const result = await addToCartAction(itemId, "product")
      if (result.error) throw new Error(result.error)
      toast({
        title: isAr ? "تمت الإضافة" : "Added to cart",
        description: isEvents
          ? (isAr ? "تمت إضافة التذكرة للسلة" : "Ticket added to cart")
          : (isAr ? "تم إضافة المنتج للسلة" : "Product added to cart"),
      })
      if (goToCart) router.push(`/${language}/cart`)
    } catch {
      toast({
        title: isAr ? "خطأ" : "Error",
        description: isAr ? "تعذرت الإضافة للسلة" : "Failed to add to cart",
        variant: "destructive",
      })
    } finally {
      setAddingToCart(null)
    }
  }

  return (
    <div className="relative z-10 min-h-screen text-foreground">
      <NavBar />
      <main className="container mx-auto px-4 pt-24 pb-8 sm:pt-28">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            {isEvents ? (isAr ? "الفعاليات" : "Events") : t("store", language)}
          </h1>
          <p className="text-foreground/75">
            {isEvents
              ? (isAr ? "اكتشف فعاليات نيون واحجز تذكرتك" : "Discover Neon events and book your ticket")
              : (isAr ? "احصل على منتجات منصة نيون" : "Get Neon products")}
          </p>
        </div>
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <EmptyIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {isEvents ? (isAr ? "لا توجد فعاليات" : "No events") : (isAr ? "لا توجد منتجات" : "No products")}
            </h3>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
              const isTicket = item.productType === "event_ticket"
              const ended = isTicket && !!item.eventEndsAt && new Date(item.eventEndsAt) < new Date()
              const available = item.availableQuantity ?? item.stockQuantity
              return (
                <Card key={item.id} className="flex min-w-0 flex-col border-border/70 bg-card/95 text-card-foreground shadow-xl shadow-background/15 backdrop-blur-sm transition-shadow hover:shadow-2xl">
                  <CardHeader>
                    <div className="relative h-48 w-full bg-muted rounded-lg overflow-hidden mb-4">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={isAr ? item.nameAr : item.nameEn} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[#17374A] text-[#E09F48]">
                          {isTicket ? <Ticket className="h-16 w-16" /> : <Package className="h-16 w-16" />}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <Badge variant="secondary">
                        {isTicket ? (isAr ? "تذكرة فعالية" : "Event Ticket") : (isAr ? item.category?.nameAr || "عام" : item.category?.nameEn || "General")}
                      </Badge>
                      <div className="text-2xl font-bold text-primary">{item.price} {isAr ? "ر.س" : "SAR"}</div>
                    </div>
                    <CardTitle className="break-words text-xl text-foreground">{isAr ? item.nameAr : item.nameEn}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="break-words text-sm text-foreground/75">{isAr ? item.descriptionAr : item.descriptionEn}</p>
                    <p className="mt-2 text-sm text-foreground/70">
                      {isTicket ? (isAr ? "التذاكر المتاحة:" : "Available tickets:") : (isAr ? "المخزون:" : "Stock:")} {available}
                    </p>
                    {isTicket && (
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" />{item.eventLocation}</p>
                        {item.eventStartsAt && <p>{new Date(item.eventStartsAt).toLocaleString(isAr ? "ar-SA" : "en-GB")}</p>}
                        <p>{isAr ? "تذكرة QR خاصة بعد تأكيد الدفع" : "Private QR ticket after payment confirmation"}</p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" onClick={() => handleAddToCart(item.id, isTicket)} disabled={available === 0 || ended || addingToCart !== null}>
                      {addingToCart === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isTicket ? <CreditCard className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                      {ended ? (isAr ? "انتهت الفعالية" : "Event ended") : available === 0 ? (isAr ? "نفذ المخزون" : "Out of stock") : addingToCart === item.id ? (isAr ? "جاري الإضافة للسلة..." : "Adding to cart...") : isTicket ? (isAr ? "احجز الآن" : "Book now") : t("addToCart", language)}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
