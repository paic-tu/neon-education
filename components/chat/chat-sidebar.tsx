"use client"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useLanguage } from "@/lib/language-context"
import { MessageSquare } from "lucide-react"

interface ChatSidebarProps {
  conversations: any[]
  selectedId?: string
  onSelect: (id: string) => void
  action?: React.ReactNode
}

export function ChatSidebar({ conversations, selectedId, onSelect, action }: ChatSidebarProps) {
  const { language } = useLanguage()
  const isAr = language === "ar"
  return (
    <div className={cn("flex h-full w-full flex-col overflow-hidden bg-background md:w-80", isAr ? "md:border-l" : "md:border-r")}>
      <div className="z-10 flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur">
        <h2 className="text-lg font-semibold">{isAr ? "الرسائل" : "Messages"}</h2>
        {action}
      </div>

      <div className="relative min-h-0 flex-1" dir={isAr ? "rtl" : "ltr"}>
        <ScrollArea className="absolute inset-0 h-full w-full">
          {conversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="rounded-full bg-muted p-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {isAr ? "لا توجد محادثات بعد" : "No conversations yet"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl p-3 text-start transition-all",
                    selectedId === conv.id
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10 border-2 border-background">
                      <AvatarImage src={conv.image || "/placeholder-user.jpg"} />
                      <AvatarFallback>{conv.name?.[0]}</AvatarFallback>
                    </Avatar>
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white ring-2 ring-background">
                        {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{conv.name}</span>
                      {conv.lastMessage && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {new Date(conv.lastMessage.createdAt).toLocaleDateString(
                            isAr ? "ar-SA" : undefined,
                            { month: "short", day: "numeric" }
                          )}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage ? (
                      <p className="truncate text-xs text-muted-foreground opacity-80 transition-opacity">
                        {conv.lastMessage.senderId === "me" && (
                          <span className="font-medium text-foreground/80">{isAr ? "أنا: " : "You: "}</span>
                        )}
                        {conv.lastMessage.content}
                      </p>
                    ) : (
                      <p className="truncate text-xs italic text-muted-foreground">
                        {isAr ? "لا توجد رسائل بعد" : "No messages yet"}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
