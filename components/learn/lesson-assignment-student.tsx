"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { CheckCircle2, CloudUpload, ExternalLink, FileText, Loader2, Paperclip, Send, Trash2 } from "lucide-react"

const MAX_TEXT_LENGTH = 5000

type Submission = {
  textContent?: string | null
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  mimeType?: string | null
  attachments?: Array<{ url: string; name: string; size?: number; mimeType?: string }> | null
  submittedAt: string | Date
  status: string
}

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

function formatDate(date: string | Date, isAr: boolean) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(isAr ? "ar-SA" : "en-US", { dateStyle: "medium", timeStyle: "short" })
}

export function LessonAssignmentStudent(props: {
  lang: string
  lessonId: string
  maxBytes: number
  allowedMimeTypes?: string[]
  allowText?: boolean
  allowFiles?: boolean
  maxFiles?: number
}) {
  const isAr = props.lang === "ar"
  const allowText = props.allowText !== false
  const allowFiles = props.allowFiles !== false
  const maxFiles = Math.min(10, Math.max(1, Number(props.maxFiles || 1)))

  const [submission, setSubmission] = useState<Submission | null>(null)
  const [textContent, setTextContent] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const maxLabel = formatBytes(props.maxBytes, isAr)
  const remaining = MAX_TEXT_LENGTH - textContent.length

  useEffect(() => {
    let mounted = true
    fetch(`/api/student/lessons/${encodeURIComponent(props.lessonId)}/assignment`)
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!mounted) return
        if (ok) {
          setSubmission(b?.submission || null)
          setTextContent(String(b?.submission?.textContent || ""))
        }
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [props.lessonId])

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    const accepted: File[] = []
    for (const f of Array.from(list)) {
      if (f.size > props.maxBytes) {
        toast.error(
          isAr
            ? `حجم الملف "${f.name}" أكبر من الحد المسموح (${maxLabel})`
            : `"${f.name}" exceeds the allowed size (${maxLabel})`
        )
        continue
      }
      if (props.allowedMimeTypes && props.allowedMimeTypes.length > 0 && !props.allowedMimeTypes.includes(f.type)) {
        toast.error(isAr ? `نوع الملف "${f.name}" غير مسموح` : `"${f.name}" has an unsupported file type`)
        continue
      }
      accepted.push(f)
    }
    if (accepted.length === 0) {
      if (fileRef.current) fileRef.current.value = ""
      return
    }

    setFiles((prev) => {
      const merged = [...prev, ...accepted]
      if (merged.length > maxFiles) {
        toast.error(isAr ? `الحد الأقصى ${maxFiles} ملف` : `You can attach up to ${maxFiles} files`)
      }
      return merged.slice(0, maxFiles)
    })
    if (fileRef.current) fileRef.current.value = ""
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadAndSubmit = () => {
    const hasText = allowText ? Boolean(textContent.trim()) : false
    const hasFiles = allowFiles ? files.length > 0 : false

    if (!hasText && !hasFiles) {
      toast.error(isAr ? "اكتب إجابة أو ارفع ملفات قبل التسليم" : "Provide an answer or upload files before submitting")
      return
    }

    startTransition(async () => {
      try {
        const attachments: Array<{ url: string; name: string; size?: number; mimeType?: string }> = []
        for (const f of files) {
          const formData = new FormData()
          formData.append("file", f)

          const up = await fetch("/api/upload", { method: "POST", body: formData })
          const upBody = await up.json().catch(() => null)
          if (!up.ok) throw new Error(upBody?.error || (isAr ? "فشل رفع الملف" : "Upload failed"))

          const url = String(upBody?.url || "")
          if (!url) throw new Error(isAr ? "فشل رفع الملف" : "Upload failed")
          attachments.push({
            url,
            name: f.name,
            size: f.size,
            mimeType: f.type || "application/octet-stream",
          })
        }

        const res = await fetch(`/api/student/lessons/${encodeURIComponent(props.lessonId)}/assignment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            textContent: allowText ? textContent.trim() || null : null,
            attachments: attachments.length > 0 ? attachments : null,
          }),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error || (isAr ? "فشل التسليم" : "Submit failed"))

        setSubmission({
          textContent: allowText ? textContent.trim() || null : null,
          attachments: attachments.length > 0 ? attachments : null,
          submittedAt: new Date().toISOString(),
          status: "submitted",
        })
        setFiles([])
        toast.success(isAr ? "تم تسليم الواجب بنجاح" : "Assignment submitted successfully")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : isAr ? "حدث خطأ غير متوقع" : "Something went wrong")
      }
    })
  }

  const existingAttachments = Array.isArray(submission?.attachments) ? submission!.attachments! : []
  const legacyFileName = !existingAttachments.length && submission?.fileUrl ? submission.fileName || submission.fileUrl.split("/").pop() : null

  return (
    <div className="space-y-5" dir={isAr ? "rtl" : "ltr"}>
      {allowText && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-primary" />
              {isAr ? "الإجابة" : "Answer"}
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
            placeholder={isAr ? "اكتب إجابتك هنا..." : "Write your answer here..."}
            className="resize-y leading-relaxed"
          />
        </div>
      )}

      {allowFiles && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-semibold">
            <Paperclip className="h-4 w-4 text-primary" />
            {isAr ? "إرفاق ملفات" : "Attach files"}
            <span className="text-xs font-normal text-muted-foreground">({isAr ? "اختياري" : "optional"})</span>
          </Label>

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple={maxFiles > 1}
            disabled={isPending}
            onChange={(e) => addFiles(e.target.files)}
          />

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, index) => (
                <div
                  key={`${f.name}-${f.size}-${f.lastModified}`}
                  className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(f.size, isAr)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeFile(index)}
                    disabled={isPending}
                    title={isAr ? "إزالة الملف" : "Remove file"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {files.length < maxFiles && (
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
                addFiles(e.dataTransfer.files)
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
                {isAr ? "اسحب الملفات هنا أو اضغط للاختيار" : "Drag & drop files here, or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isAr ? `الحد الأقصى لكل ملف ${maxLabel}` : `Maximum size per file ${maxLabel}`}
                {maxFiles > 1 ? (isAr ? ` • حتى ${maxFiles} ملفات` : ` • up to ${maxFiles} files`) : ""}
              </p>
              {props.allowedMimeTypes && props.allowedMimeTypes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {isAr ? "الأنواع المسموحة: " : "Allowed types: "}
                  {props.allowedMimeTypes.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {isAr ? "يمكنك إعادة التسليم في أي وقت، وسيتم تحديث تسليمك السابق." : "You can resubmit anytime; your previous submission will be updated."}
        </p>
        <Button type="button" onClick={uploadAndSubmit} disabled={isPending} className="gap-2 sm:min-w-[11rem]">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isPending ? (isAr ? "جارٍ التسليم..." : "Submitting...") : isAr ? "تسليم الواجب" : "Submit assignment"}
        </Button>
      </div>

      {submission && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {isAr ? "تسليمك الحالي" : "Your current submission"}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{isAr ? "تم التسليم" : "Submitted"}</Badge>
              <span className="text-xs text-muted-foreground">{formatDate(submission.submittedAt, isAr)}</span>
            </div>
          </div>

          {(existingAttachments.length > 0 || legacyFileName) && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{isAr ? "الملفات المرفقة" : "Attached files"}</p>
              <div className="space-y-2">
                {existingAttachments.length > 0
                  ? existingAttachments.map((a, idx) => (
                      <div
                        key={`${a.url}-${idx}`}
                        className="flex items-center gap-3 rounded-xl border bg-background/80 p-2.5"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Paperclip className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{a.name}</p>
                          {a.size ? <p className="text-xs text-muted-foreground">{formatBytes(a.size, isAr)}</p> : null}
                        </div>
                        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
                          <a href={a.url} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                            {isAr ? "عرض" : "View"}
                          </a>
                        </Button>
                      </div>
                    ))
                  : (
                      <div className="flex items-center gap-3 rounded-xl border bg-background/80 p-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Paperclip className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{legacyFileName}</p>
                          {submission.fileSize ? (
                            <p className="text-xs text-muted-foreground">{formatBytes(Number(submission.fileSize), isAr)}</p>
                          ) : null}
                        </div>
                        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
                          <a href={submission.fileUrl!} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                            {isAr ? "عرض" : "View"}
                          </a>
                        </Button>
                      </div>
                    )}
              </div>
            </div>
          )}

          {submission.textContent && (
            <div className="mt-3 rounded-xl border bg-background/80 p-3 text-sm leading-relaxed whitespace-pre-wrap">
              {submission.textContent}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
