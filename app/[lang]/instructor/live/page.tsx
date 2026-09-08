import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { getInstructorCourses } from "@/lib/db/queries"
import { redirect } from "next/navigation"
import { LiveCourseCard } from "./live-course-card"

export default async function InstructorLiveCoursesPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const session = await auth()
  const isAr = lang === "ar"

  if (!session?.user?.id) {
    redirect(`/${lang}/auth/login`)
  }

  const role = (session.user as any).role || "student"
  const canManageCourses = role === "instructor" || role === "admin"

  const allInstructorCourses = canManageCourses
    ? await getInstructorCourses(session.user.id)
    : []

  const liveCourses = allInstructorCourses.filter((c) => c.isLive)
  const streamingCourses = liveCourses.filter((c) => (c as any).isStreaming)

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">{isAr ? "الجلسات المباشرة" : "Live Sessions"}</h1>
          <p className="text-muted-foreground mt-2">
            {isAr
              ? "إدارة وإطلاق بث مباشر داخل دوراتك للطلاب المسجلين فقط."
              : "Manage and launch live streams inside your courses — available to enrolled students only."}
          </p>
        </div>
        <div className="flex gap-2">
          {streamingCourses.length > 0 && (
            <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-destructive-foreground" />
              {streamingCourses.length} {isAr ? "بث نشط الآن" : "Live Now"}
            </span>
          )}
          <Button asChild>
            <Link href={`/${lang}/instructor/courses/new`}>
              {isAr ? "إنشاء دورة جديدة" : "Create New Course"}
            </Link>
          </Button>
        </div>
      </div>

      {!canManageCourses ? (
        <Card>
          <CardHeader>
            <CardTitle>{isAr ? "غير مصرح" : "Access Denied"}</CardTitle>
            <CardDescription>
              {isAr
                ? "لا تمتلك صلاحية الوصول لهذه الصفحة."
                : "You do not have permission to view this page."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/${lang}/student/dashboard`}>
                {isAr ? "العودة للوحة التحكم" : "Back to Dashboard"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : liveCourses.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{isAr ? "لا توجد دورات مباشرة" : "No Live Courses found"}</CardTitle>
            <CardDescription>
              {isAr
                ? "لم تقم بإنشاء أي دورات مباشرة بعد. قم بإنشاء دورة جديدة وفّعل خيار 'دورة مباشرة (Live Course)' من إعدادات الدورة."
                : "You have not created any live courses yet. Create a new course and enable the 'Live Course' option in course settings."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild>
              <Link href={`/${lang}/instructor/courses/new`}>
                {isAr ? "إنشاء دورة مباشرة جديدة" : "Create a New Live Course"}
              </Link>
            </Button>
            {allInstructorCourses.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {isAr ? "نصيحة: يمكنك تفعيل خيار Live Course من إعدادات أي دورة موجودة." : "Tip: You can enable 'Live Course' in settings for any existing course."}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-2xl font-bold">{isAr ? "دوراتك المباشرة" : "Your Live Courses"}</h2>
              <p className="text-muted-foreground mt-1">
                {isAr ? "ابدأ البث المباشر داخل أي دورة للطلاب المسجلين فيها فقط." : "Start a live stream inside any course — enrolled students only can join."}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {liveCourses.length} {isAr ? "دورة مباشرة" : "live courses"}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveCourses.map((course) => (
              <LiveCourseCard key={course.id} course={course} isAr={isAr} lang={lang} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
