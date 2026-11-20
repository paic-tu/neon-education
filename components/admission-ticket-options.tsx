import { Check, ListChecks } from "lucide-react"
import type { SelectedEventAddOn } from "@/lib/event-add-ons"

export function AdmissionTicketOptions({ options, isAr, compact = false }: {
  options?: SelectedEventAddOn[]
  isAr: boolean
  compact?: boolean
}) {
  return (
    <section className="mt-3 min-w-0 rounded-xl border border-primary/20 bg-background p-3 text-foreground">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <ListChecks aria-hidden="true" className="size-4 shrink-0 text-primary" />
        {isAr ? "خيارات المشتري في هذه التذكرة" : "Buyer's choices for this ticket"}
      </h3>
      {options === undefined ? (
        <p className="mt-2 text-xs text-muted-foreground">{isAr ? "لم تتوفر تفاصيل الخيارات. حدّث سجل الحضور." : "Choice details unavailable. Refresh the attendance list."}</p>
      ) : options.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{isAr ? "لم يختر المشتري إضافات لهذه التذكرة." : "The buyer selected no add-ons for this ticket."}</p>
      ) : (
        <>
          {!compact && <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isAr ? "هذه الخيارات محفوظة مع الحجز، وتشمل الإضافات المجانية المختارة." : "These choices are saved with the booking, including selected free add-ons."}
          </p>}
          <ul className="mt-3 space-y-2">
            {options.map((option) => {
              const name = isAr ? option.nameAr || option.nameEn : option.nameEn || option.nameAr
              const note = isAr ? option.noteAr || option.noteEn : option.noteEn || option.noteAr
              return (
                <li key={option.id} className="rounded-lg bg-primary/5 p-3">
                  <div className="flex items-start gap-2">
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                    <bdi className="min-w-0 break-words text-sm font-semibold">{name}</bdi>
                  </div>
                  {note && (compact ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground focus-visible:outline-primary">{isAr ? "تفاصيل الخيار" : "Choice details"}</summary>
                      <p className="mt-2 whitespace-pre-line break-words text-xs leading-6 text-muted-foreground">{note}</p>
                    </details>
                  ) : (
                    <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-muted-foreground">{note}</p>
                  ))}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
