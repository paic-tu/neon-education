import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ChatLayout } from "@/components/chat/chat-layout"
import { getConversations } from "@/lib/actions/chat"

export default async function ChatPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const session = await auth()
  
  if (!session?.user) {
    redirect(`/${lang}/login`)
  }

  if (session.user.role !== "instructor" && session.user.role !== "admin") {
      redirect(`/${lang}/student/dashboard`)
  }

  const initialConversations = await getConversations()
  const isAr = lang === "ar"

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col">
      <h1 className="mb-4 hidden shrink-0 text-3xl font-bold md:block">{isAr ? "المحادثات" : "Chat"}</h1>
      <div className="min-h-0 flex-1">
        <ChatLayout
          userId={session.user.id}
          initialConversations={initialConversations}
          enableNewChat={session.user.role !== "instructor"}
        />
      </div>
    </div>
  )
}
