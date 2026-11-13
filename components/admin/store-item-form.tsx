"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import { FormLayout } from "@/components/admin/form-layout"
import { MediaUploadField } from "@/components/admin/media-upload-field"
import { toast } from "sonner"
import { Loader2, ShieldCheck } from "lucide-react"

const storeItemSchema = z.object({
  nameEn: z.string().min(1, "English name is required"),
  nameAr: z.string().min(1, "Arabic name is required"),
  descriptionEn: z.string().min(10, "English description required"),
  descriptionAr: z.string().min(10, "Arabic description required"),
  price: z.number().min(0),
  pointsCost: z.number().int().min(0).optional().nullable(),
  stock: z.number().int().min(0),
  categoryId: z.string().min(1, "Category is required").uuid("Invalid category id"),
  imageUrl: z.string().optional().or(z.literal("")).nullable(),
  isActive: z.boolean().default(true),
  productType: z.enum(["physical", "event_ticket"]).default("physical"),
  eventStartsAt: z.string().optional(),
  eventEndsAt: z.string().optional(),
  eventLocation: z.string().max(500).optional(),
})

type StoreItemFormData = z.infer<typeof storeItemSchema>

function newCreationId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

interface StoreItemFormProps {
  lang: string
  categories: Array<{ id: string; nameEn: string; nameAr: string }>
  product?: {
    id: string
    nameEn: string
    nameAr: string
    descriptionEn: string | null
    descriptionAr: string | null
    price: string
    pointsCost: number | null
    stockQuantity: number
    categoryId: string | null
    streamProductId: string | null
    imageUrl: string | null
    isActive: boolean
    productType?: "physical" | "event_ticket"
    eventStartsAt?: Date | string | null
    eventEndsAt?: Date | string | null
    eventLocation?: string | null
  }
}

export function StoreItemForm({ lang, categories, product }: StoreItemFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const creationId = useRef<string | null>(null)
  const isAr = lang === "ar"
  const localDate = (value?: Date | string | null) => {
    if (!value) return ""
    const date = new Date(value)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  const form = useForm<StoreItemFormData>({
    resolver: zodResolver(storeItemSchema),
    defaultValues: {
      nameEn: product?.nameEn || "",
      nameAr: product?.nameAr || "",
      descriptionEn: product?.descriptionEn || "",
      descriptionAr: product?.descriptionAr || "",
      price: product?.price ? Number.parseFloat(product.price) : 0,
      pointsCost: product?.pointsCost ?? null,
      stock: product?.stockQuantity ?? 0,
      categoryId: product?.categoryId || categories[0]?.id || "",
      imageUrl: product?.imageUrl || "",
      isActive: product?.isActive ?? true,
      productType: product?.productType ?? "physical",
      eventStartsAt: localDate(product?.eventStartsAt),
      eventEndsAt: localDate(product?.eventEndsAt),
      eventLocation: product?.eventLocation ?? "",
    },
  })

  async function onSubmit(data: StoreItemFormData) {
    if (isUploadingImage) {
      toast.error(isAr ? "انتظر اكتمال رفع الصورة قبل الحفظ" : "Wait for the image upload to finish before saving")
      return
    }
    setIsLoading(true)
    try {
      const isEvent = data.productType === "event_ticket"
      if (isEvent && (!data.eventStartsAt || !data.eventEndsAt || !data.eventLocation?.trim()
        || new Date(data.eventStartsAt) >= new Date(data.eventEndsAt))) {
        throw new Error(isAr ? "حدد موقع الفعالية ووقت دخول صحيحاً" : "Enter the location and a valid admission window")
      }
      if (!product && !creationId.current) creationId.current = newCreationId()
      const response = await fetch(product ? `/api/admin/store/${product.id}` : "/api/admin/store", {
        method: product ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ...(!product ? { creationId: creationId.current } : {}),
          eventStartsAt: isEvent ? new Date(data.eventStartsAt!).toISOString() : null,
          eventEndsAt: isEvent ? new Date(data.eventEndsAt!).toISOString() : null,
          eventLocation: isEvent ? data.eventLocation : null,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        if (result.error === "STREAM_PRODUCT_SYNC_FAILED") {
          throw new Error(isAr ? "تعذر إنشاء أو مزامنة منتج الدفع تلقائياً. تحقق من إعدادات Stream Pay ثم أعد المحاولة." : "Unable to sync the payment product. Check Stream Pay credentials and retry.")
        }
        if (result.error === "PRODUCT_CONCURRENT_UPDATE" || result.error === "CREATION_CONFLICT") {
          throw new Error(isAr ? "تم تغيير المنتج أثناء الحفظ. حدّث الصفحة ثم أعد المحاولة." : "The product changed while saving. Refresh and retry.")
        }
        throw new Error(result.error || (isAr ? "تعذر حفظ المنتج" : "Failed to save product"))
      }

      toast.success(isAr ? "تم حفظ المنتج وربطه بالدفع تلقائياً" : "Product saved and payment linked automatically")
      router.push(`/${lang}/admin/store`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : product ? "Failed to update store item" : "Failed to create store item")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormLayout
          title={isAr ? "نوع المنتج" : "Product Type"}
          description={isAr ? "تذاكر الفعاليات تصدر تلقائياً بعد الدفع المؤكد، وتستخدم مرة واحدة." : "Event tickets are issued after confirmed payment and admitted once."}
        >
          <FormField control={form.control} name="productType" render={({ field }) => (
            <FormItem>
              <FormLabel>{isAr ? "النوع" : "Type"}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={!!product}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="physical">{isAr ? "منتج متجر" : "Store product"}</SelectItem>
                  <SelectItem value="event_ticket">{isAr ? "تذكرة فعالية" : "Event ticket"}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          {form.watch("productType") === "event_ticket" && (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="eventStartsAt" render={({ field }) => (
                <FormItem><FormLabel>{isAr ? "بداية الدخول (توقيت جهازك)" : "Admission opens (your local time)"}</FormLabel>
                  <FormControl><Input type="datetime-local" required {...field} /></FormControl><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="eventEndsAt" render={({ field }) => (
                <FormItem><FormLabel>{isAr ? "نهاية الدخول (توقيت جهازك)" : "Admission closes (your local time)"}</FormLabel>
                  <FormControl><Input type="datetime-local" required {...field} /></FormControl><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="eventLocation" render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>{isAr ? "الموقع" : "Location"}</FormLabel>
                  <FormControl><Input required {...field} /></FormControl><FormMessage />
                </FormItem>
              )} />
              <p className="text-sm text-muted-foreground md:col-span-2">
                {isAr ? "المخزون يمثل السعة الإجمالية. الطلبات المدفوعة والمعلقة تحجز مقاعد، ويمكن تحرير المعلق بإلغائه. تعيين موظفي الدخول من صفحة الفعاليات، بواسطة الأدمن فقط."
                  : "Stock is total capacity. Paid and pending orders reserve seats; cancel pending orders to release them. Only admins can assign event staff."}
              </p>
            </div>
          )}
        </FormLayout>
        <FormLayout title="Basic Information" description="Enter store item details">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="nameEn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name (English)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Programming T-Shirt" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nameAr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name (Arabic)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="تيشيرت البرمجة" dir="rtl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (SAR)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      onChange={(e) => field.onChange(Number.parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pointsCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Points Cost (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value ? Number.parseInt(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{form.watch("productType") === "event_ticket" ? (isAr ? "سعة الفعالية" : "Event capacity") : "Stock"}</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" onChange={(e) => field.onChange(Number.parseInt(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.nameEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-xl border border-[#2F5257]/20 bg-[#2F5257]/5 p-4 md:col-span-2">
              <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />
                {isAr ? "الربط التلقائي ببوابة الدفع" : "Automatic Payment Integration"}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {isAr ? "عند الحفظ، يتم إنشاء منتج Stream Pay بنفس الاسم والسعر وربطه تلقائياً. لا تحتاج إلى إنشاء المنتج في البوابة أو إدخال المعرّف."
                  : "Saving automatically creates and links a Stream Pay product with the same name and price. No manual product ID is needed."}
              </p>
              {product?.streamProductId && <p className="mt-2 text-xs text-muted-foreground">{isAr ? "هذا المنتج مرتبط بالدفع بالفعل." : "This product is already linked to payments."}</p>}
            </div>
          </div>

          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Active</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </FormLayout>

        <FormLayout
          title={isAr ? "صورة المنتج أو الفعالية" : "Product or Event Image"}
          description={isAr ? "ارفع صورة الغلاف لتظهر في بطاقة المنتج أو الفعالية." : "Upload a cover image for the product or event card."}
        >
          <FormField
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="store-item-image">{isAr ? "صورة الغلاف" : "Cover Image"}</FormLabel>
                <MediaUploadField
                  id="store-item-image"
                  value={field.value || ""}
                  onChange={field.onChange}
                  onUploadingChange={setIsUploadingImage}
                  isAr={isAr}
                  type="image"
                  disabled={isLoading}
                  placeholder={isAr ? "ارفع صورة أو أدخل رابطها" : "Upload an image or enter its URL"}
                  helperText={isAr ? "يمكنك معاينة الصورة واستبدالها أو حذفها قبل الحفظ." : "Preview, replace, or remove the image before saving."}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </FormLayout>

        <FormLayout title="Description" description="Add item description in both languages">
          <FormField
            control={form.control}
            name="descriptionEn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (English)</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={4} placeholder="Item description..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="descriptionAr"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Arabic)</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={4} placeholder="وصف المنتج..." dir="rtl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormLayout>

        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading || isUploadingImage}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? (isAr ? "جارٍ الحفظ والربط..." : "Saving and linking...") : isAr ? (product ? "حفظ التعديلات" : "إنشاء المنتج") : (product ? "Save Changes" : "Create Store Item")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
