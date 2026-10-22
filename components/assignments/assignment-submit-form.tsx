"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { CheckCircle2, CloudUpload, ExternalLink, FileText, Loader2, Paperclip, Send, Trash2 } from "lucide-react"

const MAX_TEXT_LENGTH = 5000

function formatBytes(bytes: number | null | undefined, isAr: boolean) {
  if (!bytes || bytes <= 0) return isAr ? "0 بايت" : "0 B"
  const units = isAr ? ["بايت", "ك.ب", "م.ب", "ج.ب"] : ["B", "KB", "MB", "GB"]
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  const rounded = value >= 10 || i === 0 ? Math.round(value).toString() : value.toFixed(1)
  return `${rounded} ${units[i]}`
}

export function AssignmentSubmitForm(props: {
  lang: string
  assignmentId: string
  maxBytes: number
  existingFileUrl?: string | null
  existingFileName?: string | null
  existingTextContent?: string | null
}) {
  const isAr = props.lang === "ar"
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [textContent, setTextContent] = useState(props.existingTextContent || "")
  const [fileUrl, setFileUrl] = useState(props.existingFileUrl || "")
  const [uploadedName, setUploadedName] = useState(props.existingFileName || "")
  const [isDragging, setIsDragging] = useState(false)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const maxLabel = formatBytes(props.maxBytes, isAr)

  const pickFile = (selected: File | null) => {
    if (!selected) return
    if (props.maxBytes && selected.size > props.maxBytes) {
      toast.error(isAr ? `حجم الملف أكبر من الحد المسموح (${maxLabel})` : `File exceeds the allowed size (${maxLabel})`)
      if (fileRef.current) fileRef.current.value = ""
      return
    }
    setFile(selected)
  }

  const clearFile = () => {
    setFile(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  const submit = () => {
    const hasText = Boolean(textContent.trim())
    if (!hasText && !file) {
      toast.error(isAr ? "اكتب نصًا أو ارفع ملفًا قبل التسليم" : "Provide text or upload a file before submitting")
      return
    }

    startTransition(async () => {
      try {
        let url = ""
        if (file) {
          const formData = new FormData()
          formData.append("file", file)

          const res = await fetch("/api/upload", { method: "POST", body: formData })
          const body = await res.json().catch(() => null)
          if (!res.ok) throw new Error(body?.error || (isAr ? "فشل رفع الملف" : "Upload failed"))

          url = String(body?.url || "")
          if (!url) throw new Error(isAr ? "فشل رفع الملف" : "Upload failed")
        }

        const res2 = await fetch(`/api/student/assignments/${encodeURIComponent(props.assignmentId)}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            textContent: textContent.trim() || null,
            ...(url
              ? {
                  fileUrl: url,
                  fileName: file?.name,
                  fileSize: file?.size,
                  mimeType: file?.type || "application/octet-stream",
                }
              : {}),
          }),
        })
        const body2 = await res2.json().catch(() => null)
        if (!res2.ok) throw new Error(body2?.error || (isAr ? "فشل التسليم" : "Submit failed"))

        if (url) {
          setFileUrl(url)
          setUploadedName(file?.name || "")
        }
        clearFile()
        toast.success(isAr ? "تم تسليم الواجب بنجاح" : "Assignment submitted successfully")
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : isAr ? "حدث خطأ غير متوقع" : "Something went wrong")
      }
    })
  }

  const remaining = MAX_TEXT_LENGTH - textContent.length

  return (
    <div className="space-y-5" dir={isAr ? "rtl" : "ltr"}>
      {/* Written submission */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-primary" />
            {isAr ? "نص التسليم" : "Written submission"}
            <span className="text-xs font-normal text-muted-foreground">({isAr ? "اختياري" : "optional"})</span>
          </Label>
          <span className={cn("text-xs tabular-nums", remaining < 200 ? "text-destructive" : "text-muted-foreground")}>
            {textContent.length}/{MAX_TEXT_LENGTH}
          </span>
        </div>
        <Textarea
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          disabled={isPending}
          rows={6}
          maxLength={MAX_TEXT_LENGTH}
          placeholder={isAr ? "اكتب هنا شرحًا أو ملاحظات مع تسليمك..." : "Add a description or notes with your submission..."}
          className="resize-y leading-relaxed"
        />
      </div>

      {/* File submission */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="h-4 w-4 text-primary" />
          {isAr ? "ملف التسليم" : "Submission file"}
          <span className="text-xs font-normal text-muted-foreground">({isAr ? "اختياري" : "optional"})</span>
        </Label>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          disabled={isPending}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />

        {file ? (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size, isAr)}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={clearFile}
              disabled={isPending}
              title={isAr ? "إزالة الملف" : "Remove file"}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                fileRef.current?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              pickFile(e.dataTransfer.files?.[0] ?? null)
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40",
              isPending && "pointer-events-none opacity-60"
            )}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CloudUpload className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">
              {isAr ? "اسحب الملف هنا أو اضغط للاختيار" : "Drag & drop a file here, or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isAr ? `الحد الأقصى المسموح ${maxLabel}` : `Maximum allowed size ${maxLabel}`}
            </p>
          </div>
        )}
      </div>

      {/* Existing submitted file */}
      {fileUrl && !file && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{isAr ? "يوجد ملف مسلَّم مسبقًا" : "A file was submitted previously"}</p>
            <p className="truncate text-xs text-muted-foreground">{uploadedName || fileUrl.split("/").pop()}</p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
            <a href={fileUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              {isAr ? "عرض" : "View"}
            </a>
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse items-stretch gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {isAr
            ? "يمكنك إعادة التسليم في أي وقت، وسيتم تحديث تسليمك السابق."
            : "You can resubmit anytime; your previous submission will be updated."}
        </p>
        <Button type="button" onClick={submit} disabled={isPending} className="gap-2 sm:min-w-[11rem]">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isPending ? (isAr ? "جارٍ التسليم..." : "Submitting...") : isAr ? "تسليم الواجب" : "Submit assignment"}
        </Button>
      </div>
    </div>
  )
}
