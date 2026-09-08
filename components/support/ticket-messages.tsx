"use client"

import { useState, useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Lock } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface Message {
  id: string
  ticketId: string
  userId: string
  userName: string
  userAvatar?: string | null
  userRole: string
  content: string
  isInternal?: boolean
  createdAt: string
}

interface TicketMessagesProps {
  ticketId: string
  lang: "ar" | "en"
  initialMessages: Message[]
  currentUserId: string
  showInternalNote?: boolean
}

export function TicketMessages({ ticketId, lang, initialMessages, currentUserId, showInternalNote = false }: TicketMessagesProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages || [])
  const [reply, setReply] = useState("")
  const [loading, setLoading] = useState(false)
  const [isInternal, setIsInternal] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAr = lang === "ar"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!reply.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply, isInternal: showInternalNote ? isInternal : false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setMessages((prev) => [...prev, data.message])
      setReply("")
      setIsInternal(false)
      toast.success(isAr ? "تم إرسال الرد" : "Reply sent")
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل الإرسال" : "Failed to send"))
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleString(isAr ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  const roleLabel = (role: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      admin: { ar: "مدير", en: "Admin" },
      manager: { ar: "مدير", en: "Manager" },
      support: { ar: "دعم فني", en: "Support" },
      instructor: { ar: "مدرب", en: "Instructor" },
      student: { ar: "طالب", en: "Student" },
    }
    return map[role]?.[isAr ? "ar" : "en"] || role
  }

  return (
    <div className="flex flex-col h-[600px] border rounded-lg overflow-hidden bg-card">
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 text-muted-foreground">
            <p className="text-sm">{isAr ? "لا توجد رسائل بعد" : "No messages yet"}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isMine = msg.userId === currentUserId
              return (
                <div key={msg.id} className={`flex gap-3 ${isMine ? (isAr ? "flex-row-reverse" : "") : ""}`}>
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={msg.userAvatar || undefined} />
                    <AvatarFallback>{msg.userName?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  <div className={`flex-1 max-w-[80%] ${isMine ? (isAr ? "text-right" : "text-right") : ""}`}>
                    <div className={`flex items-center gap-2 mb-1 flex-wrap ${isMine ? (isAr ? "justify-start" : "justify-end") : ""}`}>
                      <span className="font-medium text-sm">{msg.userName}</span>
                      <Badge variant="outline" className="text-xs px-2 py-0 h-5 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                        {roleLabel(msg.userRole)}
                      </Badge>
                      {msg.isInternal && (
                        <Badge variant="secondary" className="text-xs px-2 py-0 h-5 gap-1">
                          <Lock className="h-3 w-3" />
                          {isAr ? "داخلي" : "Internal"}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDate(msg.createdAt)}</span>
                    </div>
                    <div
                      className={`inline-block p-3 rounded-lg text-sm whitespace-pre-wrap break-words ${
                        msg.isInternal
                          ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                          : isMine
                          ? "bg-indigo-500 text-white"
                          : "bg-muted"
                      }`}
                      dir="auto"
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
      <div className="border-t p-4 bg-background space-y-3">
        {showInternalNote && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="internal-note"
              checked={isInternal}
              onCheckedChange={(v) => setIsInternal(Boolean(v))}
            />
            <Label htmlFor="internal-note" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
              <Lock className="h-3 w-3" />
              {isAr ? "ملاحظة داخلية (لا تظهر للعميل)" : "Internal note (not visible to customer)"}
            </Label>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={isAr ? "اكتب ردك هنا..." : "Type your reply here..."}
            rows={3}
            className="resize-none"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={loading || !reply.trim()}
            className="bg-indigo-500 hover:bg-indigo-600 text-white h-10 shrink-0"
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{isAr ? "اضغط Ctrl+Enter للإرسال" : "Press Ctrl+Enter to send"}</p>
      </div>
    </div>
  )
}
