import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getCourseById, getEnrollment } from "@/lib/db/queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Video, Lock } from "lucide-react"
import LiveClassroomClient from "./client"

export default async function LiveClassroomPage({
  params,
}: {
  params: Promise<{ lang: string; courseId: string }>
}) {
  const { lang, courseId } = await params
  const session = await auth()
  const isAr = lang === "ar"

  if (!session?.user?.id) {
    redirect(`/${lang}/auth/login?callbackUrl=/${lang}/student/course/${courseId}/live`)
  }

  const role = (session.user as any).role || "student"
  const [course, enrollment] = await Promise.all([
    getCourseById(courseId),
    getEnrollment(session.user.id, courseId),
  ])

  if (!course) {
    redirect(`/${lang}/404`)
  }

  if (!course.isLive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "هذه الدورة غير مباشرة" : "This course is not a live course"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <Video className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            {isAr
              ? "هذه الدورة لا تدعم البث المباشر حالياً."
              : "This course does not currently support live streaming."}
          </p>
          <Button asChild>
            <Link href={`/${lang}/student/course/${courseId}`}>
              {isAr ? "العودة للدورة" : "Back to Course"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const allowed =
    role === "admin" ||
    (role === "instructor" && course.instructorId === session.user.id) ||
    (role === "student" && !!enrollment)

  if (!allowed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "غير مصرح لك بالدخول" : "Access Denied"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center text-muted-foreground">
          <Lock className="h-10 w-10" />
          <p>
            {isAr
              ? "لا يمكنك دخول هذه الجلسة إلا إذا كنت مسجلاً في هذه الدورة."
              : "You can only join this live session if you are enrolled in this course."}
          </p>
          <Button asChild>
            <Link href={`/${lang}/courses/${courseId}`}>
              {isAr ? "صفحة الدورة للانضمام" : "Course Enrollment Page"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (role === "student" && !course.isStreaming) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "الجلسات المباشرة" : "Live Sessions"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center text-muted-foreground">
          <Video className="h-10 w-10" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              {isAr ? "لا يوجد بث مباشر الآن" : "No live stream right now"}
            </p>
            <p className="text-sm">
              {isAr
                ? "سيتم تفعيل الدخول فور بدء المدرب للجلسة."
                : "Access will be enabled once the instructor starts the broadcast."}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/${lang}/student/course/${courseId}`}>
              {isAr ? "العودة للدورة" : "Back to Course"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const roomName = `course-${courseId}`

  return (
    <div className="h-[75vh] rounded-lg border overflow-hidden">
      <LiveClassroomClient
        roomName={roomName}
        user={{
          id: session.user.id,
          name: session.user.name || "User",
          role: session.user.role || "student",
        }}
        isAr={isAr}
      />
    </div>
  )
}
