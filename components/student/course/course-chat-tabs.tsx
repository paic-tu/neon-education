"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChatWindow } from "@/components/chat/chat-window"
import { Users, User } from "lucide-react"

interface CourseChatTabsProps {
  lang: string
  currentUserId: string
  groupConversationId: string
  groupName: string
  instructor: { conversationId: string; name: string; avatarUrl?: string | null } | null
}

export function CourseChatTabs({ lang, currentUserId, groupConversationId, groupName, instructor }: CourseChatTabsProps) {
  const isAr = lang === "ar"

  return (
    <Tabs defaultValue="group" className="flex min-h-0 flex-1 flex-col gap-3">
      <TabsList className="shrink-0">
        <TabsTrigger value="group" className="gap-1.5">
          <Users className="h-4 w-4" />
          {isAr ? "قروب الكورس" : "Course Group"}
        </TabsTrigger>
        {instructor && (
          <TabsTrigger value="instructor" className="gap-1.5">
            <User className="h-4 w-4" />
            {isAr ? "المدرب" : "Instructor"}
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="group" className="min-h-0">
        <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border bg-background shadow-sm" dir={isAr ? "rtl" : "ltr"}>
          <ChatWindow conversationId={groupConversationId} currentUserId={currentUserId} recipientName={groupName} />
        </div>
      </TabsContent>

      {instructor && (
        <TabsContent value="instructor" className="min-h-0">
          <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border bg-background shadow-sm" dir={isAr ? "rtl" : "ltr"}>
            <ChatWindow
              conversationId={instructor.conversationId}
              currentUserId={currentUserId}
              recipientName={instructor.name}
              recipientImage={instructor.avatarUrl || undefined}
            />
          </div>
        </TabsContent>
      )}
    </Tabs>
  )
}
