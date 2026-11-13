"use client"

import React, { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { uploadFileAction } from "@/lib/actions/upload"

interface MediaUploadFieldProps {
  id?: string
  name?: string
  label?: string
  value?: string
  onChange?: (value: string) => void
  defaultValue?: string
  placeholder?: string
  helperText?: string
  isAr?: boolean
  type?: "image" | "video"
  disabled?: boolean
  onUploadingChange?: (uploading: boolean) => void
}

export function MediaUploadField({
  id,
  name,
  label,
  value: propValue,
  onChange,
  defaultValue = "",
  placeholder,
  helperText,
  isAr = false,
  type = "image",
  disabled,
  onUploadingChange,
}: MediaUploadFieldProps) {
  const { toast } = useToast()
  const [internalValue, setInternalValue] = useState(defaultValue)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isControlled = propValue !== undefined
  const value = (isControlled ? propValue : internalValue) ?? ""

  React.useEffect(() => {
    if (!isControlled) {
      setInternalValue(defaultValue)
    }
  }, [defaultValue, isControlled])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onChange?.(newValue)
  }

  const handleValueChange = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onChange?.(newValue)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileInput = e.target
    if (fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0]
      
      // Basic validation
      if (type === "image" && !file.type.startsWith("image/")) {
        toast({
          title: isAr ? "خطأ" : "Error",
          description: isAr ? "يرجى اختيار ملف صورة" : "Please select an image file",
          variant: "destructive"
        })
        return
      }
      if (type === "video" && !file.type.startsWith("video/")) {
        toast({
          title: isAr ? "خطأ" : "Error",
          description: isAr ? "يرجى اختيار ملف فيديو" : "Please select a video file",
          variant: "destructive"
        })
        return
      }

      setIsUploading(true)
      onUploadingChange?.(true)
      try {
        const isVideoFile = file.type.startsWith("video/")
        const tryChunkedUpload = async (chunkMb?: number) => {
          let fileId = ""
          try {
            const initRes = await fetch("/api/upload/init", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                name: file.name,
                type: file.type || "application/octet-stream",
                size: file.size,
                ...(chunkMb ? { chunkMb } : {}),
              }),
            })

            if (!initRes.ok) {
              const errorData = await initRes.json().catch(() => ({}))
              throw new Error(errorData.error || `Upload init failed with status: ${initRes.status}`)
            }

            const init = await initRes.json()
            fileId = String(init?.fileId || "")
            const url = String(init?.url || "")
            const chunkSize = Number(init?.chunkSize || 0)
            const storage = String(init?.storage || "chunked")
            const uploadId = String(init?.uploadId || "")
            if (!fileId || !url || !chunkSize) throw new Error("Upload init failed")

            const totalChunks = Math.ceil(file.size / chunkSize)
            const concurrency = 4
            let nextIndex = 0
            let firstError: Error | null = null

            const uploadOne = async (i: number) => {
              const start = i * chunkSize
              const end = Math.min(file.size, start + chunkSize)
              const part = file.slice(start, end)
              if (storage === "s3") {
                if (!uploadId) throw new Error("Upload init failed")
                const partNumber = i + 1
                const signRes = await fetch(`/api/upload/part/${encodeURIComponent(fileId)}/${partNumber}`, {
                  method: "POST",
                  credentials: "include",
                })
                if (!signRes.ok) {
                  const errorData = await signRes.json().catch(() => ({}))
                  throw new Error(errorData.error || `Upload failed with status: ${signRes.status}`)
                }
                const signed = await signRes.json()
                const signedUrl = String(signed?.url || "")
                if (!signedUrl) throw new Error("Upload failed")

                const putRes = await fetch(signedUrl, {
                  method: "PUT",
                  body: part,
                })
                if (!putRes.ok) throw new Error(`Upload failed with status: ${putRes.status}`)

                const etag = putRes.headers.get("etag") || putRes.headers.get("ETag") || ""
                if (!etag) throw new Error("Upload failed")
                return { partNumber, etag }
              } else {
                const buf = await part.arrayBuffer()

                const chunkRes = await fetch(`/api/upload/chunk/${encodeURIComponent(fileId)}/${i}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/octet-stream" },
                  credentials: "include",
                  body: buf,
                })
                if (!chunkRes.ok) {
                  const errorData = await chunkRes.json().catch(() => ({}))
                  throw new Error(errorData.error || `Upload failed with status: ${chunkRes.status}`)
                }
                return null
              }
            }

            const completedParts: { partNumber: number; etag: string }[] = []
            const worker = async () => {
              while (true) {
                if (firstError) return
                const i = nextIndex
                nextIndex += 1
                if (i >= totalChunks) return
                try {
                  const partInfo = await uploadOne(i)
                  if (partInfo) completedParts.push(partInfo)
                } catch (e: any) {
                  firstError = e instanceof Error ? e : new Error(String(e?.message || e))
                  return
                }
              }
            }

            await Promise.all(Array.from({ length: Math.min(concurrency, totalChunks) }, () => worker()))
            if (firstError) throw firstError

            const completeRes = await fetch(`/api/upload/complete/${encodeURIComponent(fileId)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(
                storage === "s3"
                  ? { parts: completedParts.sort((a, b) => a.partNumber - b.partNumber) }
                  : { chunkCount: totalChunks },
              ),
            })
            if (!completeRes.ok) {
              const errorData = await completeRes.json().catch(() => ({}))
              throw new Error(errorData.error || `Upload failed with status: ${completeRes.status}`)
            }

            handleValueChange(url)
            return true
          } catch (e: any) {
            if (fileId) {
              await fetch(`/api/upload/cancel/${encodeURIComponent(fileId)}`, {
                method: "DELETE",
                credentials: "include",
              }).catch(() => {})
            }
            throw e
          }
        }

        if (type === "video" || isVideoFile || file.size > 10 * 1024 * 1024) {
          try {
            await tryChunkedUpload()
            toast({
              title: isAr ? "تم بنجاح" : "Success",
              description: isAr ? "تم رفع الملف بنجاح" : "File uploaded successfully",
            })
            return
          } catch (e: any) {
            const msg = String(e?.message || "")
            const is413 = msg.includes("413") || msg.toLowerCase().includes("too large")
            if (is413 && file.size < 5 * 1024 * 1024 * 1024) {
              for (const mb of [2, 1]) {
                await tryChunkedUpload(mb)
                toast({
                  title: isAr ? "تم بنجاح" : "Success",
                  description: isAr ? "تم رفع الملف بنجاح" : "File uploaded successfully",
                })
                return
              }
            }
            throw e
          }
        }

        const formDataFetch = new FormData()
        formDataFetch.append("file", file)
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formDataFetch,
          credentials: "include",
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          if (response.status === 401 || response.status === 403) {
            const formDataAction = new FormData()
            formDataAction.append("file", file)
            const fallback = await uploadFileAction(formDataAction)
            if (fallback?.success && fallback.url) {
              handleValueChange(fallback.url)
              toast({
                title: isAr ? "تم بنجاح" : "Success",
                description: isAr ? "تم رفع الملف بنجاح" : "File uploaded successfully",
              })
              return
            }
            throw new Error(fallback?.error || errorData.error || `Upload failed with status: ${response.status}`)
          }
          throw new Error(errorData.error || `Upload failed with status: ${response.status}`)
        }

        const result = await response.json()
        if (result.url) handleValueChange(result.url)
      } catch (error: any) {
        console.error("Upload error:", error)
        toast({
          title: isAr ? "خطأ" : "Error",
          description: error.message || (isAr ? "فشل رفع الملف" : "Failed to upload file"),
          variant: "destructive"
        })
      } finally {
        setIsUploading(false)
        onUploadingChange?.(false)
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
      }
    }
  }

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="flex gap-2">
        <Input
          id={id}
          name={name}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          className="flex-1"
          disabled={disabled || isUploading}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              {isAr ? "رفع" : "Upload"}
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={type === "image" ? "image/*" : "video/*"}
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || isUploading}
        />
      </div>
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
      
      {value && (
        <div className="mt-2 relative rounded-md overflow-hidden border bg-muted w-full max-w-xs">
          {type === "image" ? (
            <div className="aspect-video relative">
              <Image 
                src={value} 
                alt="Preview" 
                fill 
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <>
              {(value.includes("youtube.com") || value.includes("youtu.be") || value.includes("vimeo.com")) ? (
                <iframe
                  src={
                    value.includes("vimeo.com")
                      ? `https://player.vimeo.com/video/${value.split("/").pop()}`
                      : `https://www.youtube.com/embed/${value.includes("v=") ? value.split("v=")[1].split("&")[0] : value.split("/").pop()}`
                  }
                  className="w-full aspect-video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video 
                  src={value} 
                  controls 
                  className="w-full aspect-video"
                />
              )}
            </>
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 rounded-full opacity-70 hover:opacity-100"
            onClick={() => handleValueChange("")}
            disabled={disabled || isUploading}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
