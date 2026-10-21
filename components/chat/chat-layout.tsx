"use client"

import { useState, useEffect } from "react"
import { ChatSidebar } from "./chat-sidebar"
import { ChatWindow } from "./chat-window"
import { NewChatDialog } from "./new-chat-dialog"
import { getConversations } from "@/lib/actions/chat"
import { Loader2 } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { cn } from "@/lib/utils"

interface ChatLayoutProps {
  userId: string
  initialConversations?: any[]
  enableNewChat?: boolean
}

export function ChatLayout({ userId, initialConversations = [], enableNewChat = true }: ChatLayoutProps) {
  const { language } = useLanguage()
  const isAr = language === "ar"
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(!initialConversations.length)
  const [isMobile, setIsMobile] = useState(false)

  // Simple mobile detection
  useEffect(() => {
    const computeIsMobile = () => {
      const ua = navigator.userAgent || ""
      const isUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
      const coarse = window.matchMedia("(pointer: coarse)").matches
      const small = window.matchMedia("(max-width: 900px)").matches
      return isUA || coarse || small
    }
    const apply = () => setIsMobile(computeIsMobile())
    apply()
    window.addEventListener("resize", apply)
    window.addEventListener("orientationchange", apply)
    return () => {
      window.removeEventListener("resize", apply)
      window.removeEventListener("orientationchange", apply)
    }
  }, [])

  const fetchConversations = async () => {
    try {
      const data = await getConversations()
      setConversations(data)
      setLoading(false)
    } catch (error) {
      console.error("Failed to fetch conversations", error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConversations()
    const interval = setInterval(fetchConversations, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleSelectConversation = (id: string) => {
    setSelectedId(id)
  }

  const handleNewChat = async (id: string) => {
    await fetchConversations()
    setSelectedId(id)
  }

  const selectedConversation = conversations.find((c) => c.id === selectedId)

  // Mobile View Logic
  if (isMobile) {
    if (selectedId) {
      return (
        <div className="flex h-full flex-col overflow-hidden bg-background">
          <ChatWindow
            conversationId={selectedId}
            currentUserId={userId}
            recipientName={selectedConversation?.name}
            recipientImage={selectedConversation?.image}
            onBack={() => setSelectedId(undefined)}
          />
        </div>
      )
    }

    return (
      <div className="flex h-full flex-col overflow-hidden bg-background">
        <ChatSidebar
          conversations={conversations}
          selectedId={selectedId}
          onSelect={handleSelectConversation}
          action={enableNewChat ? <NewChatDialog onChatCreated={handleNewChat} /> : undefined}
        />
      </div>
    )
  }

  // Desktop View
  return (
    <div className={cn("flex h-full min-h-0 overflow-hidden rounded-2xl border bg-background shadow-sm")} dir={isAr ? "rtl" : "ltr"}>
      <div className="flex-none h-full">
        <ChatSidebar
          conversations={conversations}
          selectedId={selectedId}
          onSelect={handleSelectConversation}
          action={enableNewChat ? <NewChatDialog onChatCreated={handleNewChat} /> : undefined}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        {selectedId ? (
          <ChatWindow
            conversationId={selectedId}
            currentUserId={userId}
            recipientName={selectedConversation?.name}
            recipientImage={selectedConversation?.image}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground bg-muted/10">
            <div className="flex flex-col items-center gap-2">
              <div className="p-4 rounded-full bg-muted">
                <Loader2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <p>{isAr ? "اختر محادثة لبدء الدردشة" : "Select a conversation to start chatting"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
