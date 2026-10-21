import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getCourseById } from "@/lib/db/queries"
import { getOrCreateCourseChat, createPrivateChat } from "@/lib/actions/chat"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CourseChatTabs } from "@/components/student/course/course-chat-tabs"

export default async function CourseChatPage(props: { params: Promise<{ lang: string; courseId: string }> }) {
  const { lang, courseId } = await props.params
  const isAr = lang === "ar"
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/${lang}/auth/login?callbackUrl=/${lang}/student/course/${courseId}/chat`)
  }

  const course = await getCourseById(courseId)
  const groupResult = await getOrCreateCourseChat(courseId)

  if (!course || groupResult.error || !groupResult.conversationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "تعذّر فتح المحادثة" : "Couldn't open chat"}</CardTitle>
          <CardDescription>
            {isAr
              ? "تأكد إنك مسجل بهذا الكورس، أو حاول تحديث الصفحة."
              : "Make sure you're enrolled in this course, or try refreshing the page."}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const groupName = isAr ? course.titleAr : course.titleEn
  const instructorUser = (course as any).instructor as
    | { id: string; name: string; avatarUrl: string | null }
    | undefined

  let instructor: { conversationId: string; name: string; avatarUrl?: string | null } | null = null
  if (instructorUser && instructorUser.id !== session.user.id) {
    const dmResult = await createPrivateChat(instructorUser.id)
    if (dmResult.conversationId) {
      instructor = {
        conversationId: dmResult.conversationId,
        name: instructorUser.name,
        avatarUrl: instructorUser.avatarUrl,
      }
    }
  }

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold sm:text-3xl">{isAr ? "المحادثات" : "Chat"}</h1>
        <p className="text-sm text-muted-foreground">
          {isAr ? "تواصل مع زملائك ومدرب هذا الكورس" : "Talk with your classmates and this course's instructor"}
        </p>
      </div>

      <CourseChatTabs
        lang={lang}
        currentUserId={session.user.id}
        groupConversationId={groupResult.conversationId}
        groupName={groupName}
        instructor={instructor}
      />
    </div>
  )
}
