"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import { toast } from "sonner"

interface NewTicketDialogProps {
  lang: "ar" | "en"
  onCreated?: (ticketId: string) => void
}

const categories = [
  { value: "technical", ar: "فني", en: "Technical" },
  { value: "billing", ar: "فواتير", en: "Billing" },
  { value: "course_content", ar: "دورات", en: "Courses" },
  { value: "account", ar: "حساب", en: "Account" },
  { value: "other", ar: "أخرى", en: "Other" },
]

export function NewTicketDialog({ lang, onCreated }: NewTicketDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: "",
    category: "technical",
    description: "",
  })

  const isAr = lang === "ar"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) {
      toast.error(isAr ? "الرجاء ملء جميع الحقول المطلوبة" : "Please fill in all required fields")
      return
    }

    setLoading(true)
    try {
      const payload = {
        subjectAr: form.title,
        subjectEn: form.title,
        descriptionAr: form.description,
        descriptionEn: form.description,
        category: form.category,
        priority: "normal",
      }
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      toast.success(isAr ? "تم إنشاء التذكرة بنجاح" : "Ticket created successfully")
      setOpen(false)
      setForm({ title: "", category: "technical", description: "" })
      if (onCreated && data.ticket?.id) onCreated(data.ticket.id)
      else window.location.reload()
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل إنشاء التذكرة" : "Failed to create ticket"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-500 hover:bg-indigo-600 text-white">
          <Plus className={`h-4 w-4 ${isAr ? "ml-2" : "mr-2"}`} />
          {isAr ? "+ تذكرة جديدة" : "+ New Ticket"}
        </Button>
      </DialogTrigger>
      <DialogContent className={isAr ? "sm:max-w-[500px]" : "sm:max-w-[500px]"} dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{isAr ? "إنشاء تذكرة دعم جديدة" : "Create New Support Ticket"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="title">{isAr ? "عنوان التذكرة" : "Ticket Title"} *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={isAr ? "وصف مختصر للمشكلة" : "Brief description of the issue"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">{isAr ? "الفئة" : "Category"}</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger id="category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {isAr ? c.ar : c.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{isAr ? "الوصف التفصيلي" : "Detailed Description"} *</Label>
            <Textarea
              id="description"
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={isAr ? "اشرح المشكلة بالتفصيل..." : "Explain the issue in detail..."}
            />
          </div>
          <div className={`flex gap-2 ${isAr ? "justify-start" : "justify-end"}`}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white" disabled={loading}>
              {loading ? (isAr ? "جاري الإرسال..." : "Submitting...") : (isAr ? "إرسال التذكرة" : "Submit Ticket")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
