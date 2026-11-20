"use client"

import { ChevronDown, Loader2, Sparkles } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { eventItemUnitPrice, type EventAddOn } from "@/lib/event-add-ons"
import { cn } from "@/lib/utils"

export function CartEventOptions({
  itemId, options, selectedIds, quantity, isAr, disabled, saving, onChange,
}: {
  itemId: string
  options: EventAddOn[]
  selectedIds: string[]
  quantity: number
  isAr: boolean
  disabled: boolean
  saving: boolean
  onChange: (id: string, checked: boolean) => void
}) {
  const selected = options.filter((option) => selectedIds.includes(option.id))
  const extra = eventItemUnitPrice("0", selected)
  const money = (value: string) => `${Number(value).toFixed(2)} ${isAr ? "ر.س" : "SAR"}`

  return (
    <fieldset disabled={disabled} aria-busy={saving} className="mt-5 min-w-0 space-y-3">
      <legend className="flex items-center gap-2 text-base font-semibold">
        <Sparkles aria-hidden="true" className="size-4 text-primary" />
        {isAr ? "أضف لتجربتك" : "Enhance your experience"}
      </legend>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {isAr ? "اختر ما يناسبك. يمكنك اختيار أكثر من إضافة، أو المتابعة بدون إضافات." : "Choose what suits you. Select multiple add-ons, or continue without any."}
      </p>
      <div className="space-y-3">
        {options.map((option) => {
          const checked = selectedIds.includes(option.id)
          const name = isAr ? option.nameAr : option.nameEn
          const note = isAr ? option.noteAr || option.noteEn : option.noteEn || option.noteAr
          const id = `${itemId}-${option.id}`
          return (
            <div key={option.id} className={cn(
              "min-w-0 overflow-hidden rounded-xl border bg-card transition-colors",
              checked ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/35",
            )}>
              <label htmlFor={id} className={cn(
                "flex min-h-20 items-start gap-3 p-4",
                disabled ? "cursor-wait opacity-70" : "cursor-pointer",
              )}>
                <Checkbox id={id} checked={checked} disabled={disabled}
                  className="mt-1 size-5 rounded-md"
                  aria-describedby={note ? `${id}-note` : undefined}
                  onCheckedChange={(value) => onChange(option.id, value === true)} />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <bdi className="break-words text-sm font-semibold sm:text-base">{name}</bdi>
                    <span className="shrink-0 rounded-md bg-background/80 px-2.5 py-1 text-sm font-bold text-primary">
                      {Number(option.price) === 0 ? (isAr ? "بدون تكلفة إضافية" : "No extra charge") : `+ ${money(option.price)}`}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className={checked ? "font-medium text-primary" : "text-muted-foreground"}>
                      {checked ? (isAr ? "تم الاختيار" : "Selected") : (isAr ? "إضافة اختيارية" : "Optional add-on")}
                    </span>
                    {Number(option.price) > 0 && <span className="text-muted-foreground">{isAr ? "لكل تذكرة" : "Per ticket"}</span>}
                  </span>
                </span>
              </label>
              {note && (
                <details className="group border-t border-border/60">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
                    {isAr ? "ما الذي تتضمنه الإضافة؟" : "What's included?"}
                    <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                  </summary>
                  <p id={`${id}-note`} className="whitespace-pre-line break-words px-4 pb-4 text-sm leading-7 text-foreground/80">{note}</p>
                </details>
              )}
            </div>
          )
        })}
      </div>
      {selectedIds.filter((id) => !options.some((option) => option.id === id)).map((id) => (
        <div key={id} role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <span>{isAr ? "إضافة سابقة لم تعد متاحة. احذفها للمتابعة." : "A selected add-on is unavailable. Remove it to continue."}</span>
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange(id, false)}>{isAr ? "حذف" : "Remove"}</Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs">
        <span className="text-muted-foreground">
          {isAr ? `تُطبّق الإضافات المختارة على جميع التذاكر (${quantity}).` : `Selected add-ons apply to all tickets (${quantity}).`}
        </span>
        <span className="font-semibold">{isAr ? "الإضافات لكل تذكرة:" : "Add-ons per ticket:"} {money(extra)}</span>
      </div>
      {saving && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
        {isAr ? "جاري حفظ اختياراتك..." : "Saving your choices..."}
      </p>}
    </fieldset>
  )
}
