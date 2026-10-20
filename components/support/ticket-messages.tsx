"use client"

import { useState, useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Lock, MessageSquarePlus, CornerDownLeft, ShieldCheck, Headset, GraduationCap, User } from "lucide-react"
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

const roleMeta: Record<string, { ar: string; en: string; className: string; icon: typeof User }> = {
  admin: {
    ar: "مدير",
    en: "Admin",
    className: "border-primary/30 bg-primary/10 text-primary",
    icon: ShieldCheck,
  },
  manager: {
    ar: "مدير",
    en: "Manager",
    className: "border-primary/30 bg-primary/10 text-primary",
    icon: ShieldCheck,
  },
  support: {
    ar: "دعم فني",
    en: "Support",
    className: "border-accent/30 bg-accent/10 text-accent",
    icon: Headset,
  },
  instructor: {
    ar: "مدرب",
    en: "Instructor",
    className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
    icon: GraduationCap,
  },
  student: {
    ar: "طالب",
    en: "Student",
    className: "border-border/60 bg-muted/60 text-muted-foreground",
    icon: User,
  },
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

  const getRole = (role: string) =>
    roleMeta[role] || { ar: role, en: role, className: "border-border/60 bg-muted/60 text-muted-foreground", icon: User }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/50 backdrop-blur">
      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />

      <ScrollArea ref={scrollRef} className="relative h-[520px]">
        <div className="p-4 sm:p-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-center">
              <div className="relative flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-background/60">
                <MessageSquarePlus className="size-6 text-muted-foreground" />
                <span className="absolute -inset-1 -z-10 rounded-3xl bg-primary/20 blur-xl" />
              </div>
              <p className="text-sm text-muted-foreground">
                {isAr ? "لا توجد رسائل بعد" : "No messages yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((msg) => {
                const isMine = msg.userId === currentUserId
                const role = getRole(msg.userRole)
                const RoleIcon = role.icon
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isMine ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar
                      className={`size-9 shrink-0 ring-2 ${
                        isMine ? "ring-primary/30" : "ring-border/60"
                      }`}
                    >
                      <AvatarImage src={msg.userAvatar || undefined} />
                      <AvatarFallback
                        className={
                          isMine
                            ? "bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-semibold"
                            : "bg-muted text-muted-foreground text-xs font-semibold"
                        }
                      >
                        {msg.userName?.charAt(0)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[80%] flex-1 ${isMine ? "text-right" : ""}`}>
                      <div
                        className={`mb-1.5 flex flex-wrap items-center gap-2 ${
                          isMine ? (isAr ? "justify-start" : "justify-end") : ""
                        }`}
                      >
                        <span className="text-sm font-semibold">{msg.userName}</span>
                        <Badge variant="outline" className={`h-5 gap-1 px-2 py-0 text-xs ${role.className}`}>
                          <RoleIcon className="size-3" />
                          {role[isAr ? "ar" : "en"]}
                        </Badge>
                        {msg.isInternal && (
                          <Badge
                            variant="outline"
                            className="h-5 gap-1 border-amber-500/30 bg-amber-500/10 px-2 py-0 text-xs text-amber-600 dark:text-amber-300"
                          >
                            <Lock className="size-3" />
                            {isAr ? "داخلي" : "Internal"}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{formatDate(msg.createdAt)}</span>
                      </div>
                      <div
                        className={`relative inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.isInternal
                            ? "border border-amber-500/30 bg-amber-500/10 text-amber-900 shadow-sm shadow-amber-500/10 dark:text-amber-200"
                            : isMine
                            ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20"
                            : "border border-border/60 bg-muted/60 text-foreground backdrop-blur"
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
        </div>
      </ScrollArea>

      <div className="relative space-y-3 border-t border-border/60 bg-background/40 p-4 backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        {showInternalNote && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="internal-note"
              checked={isInternal}
              onCheckedChange={(v) => setIsInternal(Boolean(v))}
            />
            <Label
              htmlFor="internal-note"
              className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground"
            >
              <Lock className="size-3" />
              {isAr ? "ملاحظة داخلية (لا تظهر للعميل)" : "Internal note (not visible to customer)"}
            </Label>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={isAr ? "اكتب ردك هنا..." : "Type your reply here..."}
            rows={3}
            className="resize-none border-border/60 bg-background/60 backdrop-blur focus-visible:ring-primary/40"
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
            className="h-[76px] w-12 shrink-0 bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90"
            size="icon"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CornerDownLeft className="size-3" />
          {isAr ? "اضغط Ctrl+Enter للإرسال" : "Press Ctrl+Enter to send"}
        </p>
      </div>
    </div>
  )
}
