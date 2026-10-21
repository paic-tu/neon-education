"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send, Loader2, ArrowLeft, Paperclip, Smile, File, Download, X } from "lucide-react"
import { getMessages, sendMessage, notifyTyping, getTypingUsers, markConversationAsRead } from "@/lib/actions/chat"
import { cn } from "@/lib/utils"
import { GifPicker } from "./gif-picker"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserActionPopover } from "./user-action-popover"
import { useLanguage } from "@/lib/language-context"
import { uploadFileAction } from "@/lib/actions/upload"

const formSchema = z.object({
  content: z.string().min(1),
})

interface ChatWindowProps {
  conversationId: string
  currentUserId: string
  recipientName?: string
  recipientImage?: string
  onBack?: () => void
}

export function ChatWindow({ conversationId, currentUserId, recipientName, recipientImage, onBack }: ChatWindowProps) {
  const { language } = useLanguage()
  const isAr = language === "ar"
  const [messages, setMessages] = useState<any[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastTypedTime = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      let url = ""
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
            url = fallback.url
          } else {
            throw new Error(fallback?.error || errorData.error || "Upload failed")
          }
        } else {
          throw new Error(errorData.error || "Upload failed")
        }
      } else {
        const data = await response.json()
        url = String(data?.url || "")
        if (!url) throw new Error("Upload failed")
      }
      const type = file.type.startsWith("image/") ? "image" : "file"
      
      await sendMessage(conversationId, file.name, type, url)
      
      // Optimistic update or refetch
      const data = await getMessages(conversationId)
      setMessages(data)
    } catch (error) {
      console.error("Failed to upload file:", error)
      // You might want to show a toast here
    } finally {
      setIsUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
    },
  })

  // Role badge label
  const roleLabel = (role?: string) => {
    if (!role) return ""
    if (!isAr) return role
    if (role === "admin") return "مدير"
    if (role === "instructor") return "مدرب"
    if (role === "manager") return "مدير عام"
    if (role === "support") return "دعم فني"
    return "طالب"
  }

  // Format date helper
  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (isAr) {
      if (date.toDateString() === now.toDateString()) {
        return `اليوم ${date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`
      } else if (date.toDateString() === yesterday.toDateString()) {
        return `أمس ${date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`
      } else {
        return date.toLocaleDateString('ar-SA') + " " + date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
      }
    }
    if (date.toDateString() === now.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  // Poll for new messages and typing status
  useEffect(() => {
    let interval: NodeJS.Timeout

    const fetchData = async () => {
      try {
        const [msgsData, typingData] = await Promise.all([
          getMessages(conversationId),
          getTypingUsers(conversationId)
        ])
        setMessages(msgsData)
        setTypingUsers(typingData)
        setLoading(false)
      } catch (error) {
        console.error("Failed to fetch chat data:", error)
      }
    }

    fetchData()
    interval = setInterval(fetchData, 3000) // Poll every 3 seconds

    return () => clearInterval(interval)
  }, [conversationId])

  // Mark conversation as read when messages change
  useEffect(() => {
    if (messages.length > 0) {
      markConversationAsRead(conversationId)
    }
  }, [conversationId, messages.length])

  // Scroll to bottom on new messages
  const prevMessagesLength = useRef(0)

  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: "smooth" })
      }
    }
    prevMessagesLength.current = messages.length
  }, [messages.length])

  const watchContent = form.watch("content")

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!values.content.trim()) return

    try {
      await sendMessage(conversationId, values.content)
      form.reset()
      // Optimistic update could be added here
      const data = await getMessages(conversationId)
      setMessages(data)
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }

  async function onGifSelect(url: string, type: "gif" | "sticker") {
    try {
      await sendMessage(conversationId, type === "gif" ? "Sent a GIF" : "Sent a Sticker", type, url)
      const data = await getMessages(conversationId)
      setMessages(data)
    } catch (error) {
      console.error("Failed to send GIF/Sticker:", error)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background w-full overflow-hidden" dir={isAr ? "rtl" : "ltr"}>
      <div className="z-10 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-4 shadow-sm backdrop-blur">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="-ms-2 shrink-0 md:hidden">
            <ArrowLeft className={cn("h-5 w-5", isAr && "rotate-180")} />
          </Button>
        )}
        <Avatar className="h-9 w-9 shrink-0 border">
            <AvatarImage src={recipientImage || "/placeholder-user.jpg"} />
            <AvatarFallback>{recipientName?.[0]}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-sm font-semibold leading-none">{recipientName || (isAr ? "الدردشة" : "Chat")}</h2>
          {typingUsers.length > 0 && (
            <span className="text-[10px] text-muted-foreground animate-pulse truncate">
              {isAr ? (typingUsers.length === 1 ? "يكتب..." : "يكتبون...") : (typingUsers.length === 1 ? "typing..." : "people typing...")}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full w-full p-4 absolute inset-0" dir={isAr ? "rtl" : "ltr"}>
          <div className="flex flex-col gap-4 pb-4">
          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUserId
            const isSameSender = index > 0 && messages[index - 1].senderId === msg.senderId

            const senderAvatar = (
              <UserActionPopover user={msg.sender} currentUserId={currentUserId}>
                <Avatar className="h-8 w-8 shrink-0 cursor-pointer transition-transform hover:scale-105">
                  <AvatarImage src={msg.sender?.avatarUrl || "/placeholder-user.jpg"} />
                  <AvatarFallback>{msg.sender?.name?.[0]}</AvatarFallback>
                </Avatar>
              </UserActionPopover>
            )

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex items-end gap-2",
                  isMe ? "justify-end" : "justify-start",
                  !isSameSender && "mt-5"
                )}
              >
                {!isMe && (isSameSender ? <div className="w-8 shrink-0" /> : senderAvatar)}

                <div className={cn("group flex min-w-0 max-w-[85%] flex-col md:max-w-[70%]", isMe ? "items-end" : "items-start")}>
                  {!isSameSender && (
                    <div className="mb-1 flex flex-wrap items-center gap-2 opacity-70 transition-opacity group-hover:opacity-100">
                      <UserActionPopover user={msg.sender} currentUserId={currentUserId}>
                        <span className="cursor-pointer text-xs font-semibold hover:underline">
                          {msg.sender?.name}
                        </span>
                      </UserActionPopover>
                      {msg.sender?.role && (
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-white",
                          msg.sender.role === "admin" ? "bg-red-500/90" :
                          msg.sender.role === "instructor" ? "bg-blue-500/90" :
                          msg.sender.role === "manager" ? "bg-purple-500/90" :
                          msg.sender.role === "support" ? "bg-amber-500/90" :
                          "bg-green-500/90"
                        )}>
                          {roleLabel(msg.sender.role)}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatMessageDate(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  <div className={cn(
                    "relative whitespace-pre-wrap text-sm leading-relaxed shadow-sm transition-all",
                    msg.type === "sticker" ? "min-w-0 bg-transparent p-0 shadow-none" :
                    (msg.type === "gif" || msg.type === "image") ? "min-w-[180px] overflow-hidden rounded-2xl p-0" :
                    msg.type === "file" ? "rounded-2xl p-1" :
                    "min-w-[100px] rounded-2xl px-4 py-2 pb-6",
                    msg.type === "text" && (isMe
                      ? "bg-primary text-primary-foreground"
                      : "border bg-white text-foreground/90 dark:bg-muted")
                  )}>
                    {msg.type === "sticker" ? (
                      <Image 
                        src={msg.attachmentUrl} 
                        alt="Sticker" 
                        width={128} 
                        height={128} 
                        className="object-contain" 
                        unoptimized
                      />
                    ) : msg.type === "gif" ? (
                      <Image 
                        src={msg.attachmentUrl} 
                        alt="GIF" 
                        width={0}
                        height={0}
                        sizes="100vw"
                        className="w-full max-w-[250px] h-auto object-cover" 
                        unoptimized
                      />
                    ) : msg.type === "image" ? (
                      <div className="group/img relative">
                      <Image 
                        src={msg.attachmentUrl} 
                        alt="Image" 
                        width={0}
                        height={0}
                        sizes="100vw"
                        className="w-full max-w-[250px] h-auto object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity" 
                        onClick={() => window.open(msg.attachmentUrl, '_blank')} 
                        unoptimized
                      />
                       <a 
                        href={msg.attachmentUrl} 
                        download 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-2 end-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-black/70"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      </div>
                    ) : msg.type === "file" ? (
                      <div className="flex items-center gap-3 bg-secondary/50 p-2 rounded-lg">
                        <div className="bg-background p-2 rounded-md">
                          <File className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex flex-col min-w-0 max-w-[150px]">
                          <span className="text-sm font-medium truncate" title={msg.content}>
                            {msg.content}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase">{isAr ? "ملف" : "FILE"}</span>
                        </div>
                        <a 
                          href={msg.attachmentUrl} 
                          download 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ms-auto p-1.5 hover:bg-background rounded-full transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    ) : (
                      msg.content
                    )}
                    
                    {msg.type === "text" && (
                      <span className={cn(
                        "absolute bottom-1.5 end-3 text-[10px] opacity-70 select-none font-medium",
                        isMe ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                {isMe && (isSameSender ? <div className="w-8 shrink-0" /> : senderAvatar)}
              </div>
            )
          })
          )}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>
                {isAr
                  ? `${typingUsers.join("، ")} ${typingUsers.length === 1 ? "يكتب الآن..." : "يكتبون الآن..."}`
                  : `${typingUsers.join(", ")} ${typingUsers.length === 1 ? "is" : "are"} typing...`}
              </span>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
    </div>

    <div className="p-3 border-t bg-background/95 backdrop-blur shrink-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-2 bg-muted/50 p-2 rounded-2xl border focus-within:ring-1 focus-within:ring-ring transition-all">
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button 
              type="button" 
              size="icon" 
              variant="ghost" 
              className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-full shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            </Button>

            <GifPicker onSelect={onGifSelect} />
            
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem className="flex-1 min-w-0">
                  <FormControl>
                    <Textarea 
                      placeholder={isAr ? "اكتب رسالة..." : "Type a message..."} 
                      {...field} 
                      className="min-h-[20px] max-h-32 resize-none py-2.5 px-0 bg-transparent border-0 focus-visible:ring-0 shadow-none leading-relaxed"
                      dir={isAr ? "rtl" : "ltr"}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          form.handleSubmit(onSubmit)()
                          return
                        }
                        
                        // Notify typing
                        const now = Date.now()
                        if (now - lastTypedTime.current > 2000) {
                          lastTypedTime.current = now
                          notifyTyping(conversationId)
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <Button type="submit" size="icon" disabled={form.formState.isSubmitting || !watchContent?.trim()} className="h-9 w-9 rounded-full shrink-0 mb-0.5 transition-all">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
