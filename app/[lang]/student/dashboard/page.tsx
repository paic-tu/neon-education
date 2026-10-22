import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { BookOpen, Trophy, Award, PlayCircle, Clock, Video } from "lucide-react"
import { getStudentDashboardData } from "@/lib/db/queries"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

export default async function StudentDashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const user = await getCurrentUser()
  
  if (!user || user.role !== "student") {
    redirect(`/${lang}/dashboard`)
  }

  const data = await getStudentDashboardData(user.id)
  const isAr = lang === "ar"

  return (
    <div className="container py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">{isAr ? "لوحة التحكم" : "Student Dashboard"}</h1>
          <p className="text-muted-foreground">{isAr ? `مرحباً بك، ${user.name}` : `Welcome back, ${user.name}`}</p>
        </div>
        <Button asChild>
          <Link href={`/${lang}/student/browse`}>{isAr ? "تصفح الدورات" : "Browse Courses"}</Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isAr ? "الدورات المسجلة" : "Enrolled Courses"}</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.activeCourses}</div>
            <p className="text-xs text-muted-foreground">{isAr ? "دورات نشطة" : "Active courses"}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isAr ? "الدورات المكتملة" : "Completed"}</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.completedCourses}</div>
            <p className="text-xs text-muted-foreground">{isAr ? "تم إنجازها" : "Courses finished"}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isAr ? "الشهادات" : "Certificates"}</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.certificates}</div>
            <p className="text-xs text-muted-foreground">{isAr ? "شهادة مكتسبة" : "Earned certificates"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Resume Learning */}
      {data.lastActivity && (
        <Card className="bg-primary/5 border-primary/20 hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              {isAr ? "استئناف التعلم" : "Continue Learning"}
            </CardTitle>
            <CardDescription>
              {isAr ? "أنت تشاهد حالياً:" : "You were watching:"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-2 w-full">
              <h3 className="font-semibold text-lg line-clamp-1">{isAr ? data.lastActivity.courseTitleAr : data.lastActivity.courseTitleEn}</h3>
              <p className="text-sm text-muted-foreground line-clamp-1">{isAr ? data.lastActivity.lessonTitleAr : data.lastActivity.lessonTitleEn}</p>
              <div className="w-full max-w-md">
                 <div className="flex justify-between text-xs text-muted-foreground mb-1">
                   <span>{isAr ? "التقدم" : "Progress"}</span>
                   <span>{data.lastActivity.progress}%</span>
                 </div>
                 <Progress value={data.lastActivity.progress || 0} className="h-2" />
              </div>
            </div>
            <Button asChild size="lg" className="w-full md:w-auto shrink-0">
              <Link href={`/${lang}/student/learn/${data.lastActivity.courseId}/${data.lastActivity.lessonId}`}>
                {isAr ? "متابعة الدرس" : "Resume Lesson"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Live Courses */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-red-600" />
            {isAr ? "الدورات المباشرة" : "Live Courses"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.liveCourses.length > 0 ? (
            <div className="space-y-3">
              {data.liveCourses.map((c: any) => (
                <div
                  key={c.courseId}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border border-red-500/20 bg-red-50 dark:bg-red-900/10 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
                    </span>
                    <h4 className="font-semibold line-clamp-1">{isAr ? c.titleAr : c.titleEn}</h4>
                  </div>
                  <Button asChild size="sm" className="w-full sm:w-auto shrink-0">
                    <Link href={`/${lang}/student/course/${c.courseId}/live`}>
                      {isAr ? "انضم الآن" : "Join Now"}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Video className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {isAr ? "لا يوجد بث مباشر الآن" : "No live courses now"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">
        <Card className="col-span-1 lg:col-span-4 hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>{isAr ? "دوراتي" : "My Courses"}</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.enrolledCourses?.length > 0 ? (
              <div className="space-y-4">
                {data.enrolledCourses.map((enrollment: any) => (
                  <div key={enrollment.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    {enrollment.course?.thumbnailUrl ? (
                      <div className="relative w-full h-40 sm:w-24 sm:h-16 shrink-0">
                        <Image
                          src={enrollment.course?.thumbnailUrl}
                          alt={isAr ? enrollment.course?.titleAr : enrollment.course?.titleEn}
                          fill
                          className="object-cover rounded-md"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-full h-40 sm:w-24 sm:h-16 bg-muted rounded-md flex items-center justify-center">
                        <BookOpen className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 space-y-1 w-full">
                      <div className="flex justify-between items-start">
                         <h4 className="font-semibold line-clamp-1 text-base">
                            {isAr ? enrollment.course?.titleAr : enrollment.course?.titleEn}
                         </h4>
                         {enrollment.progress === 100 && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 shrink-0 ml-2">
                              {isAr ? "مكتمل" : "Done"}
                            </Badge>
                         )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {enrollment.course?.instructor?.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                        <Progress value={enrollment.progress} className="h-1.5 w-24" />
                        <span>{enrollment.progress}%</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="w-full sm:w-auto mt-2 sm:mt-0">
                       <Link href={`/${lang}/student/course/${enrollment.courseId}`}>
                          {isAr ? "عرض" : "View"}
                       </Link>
                    </Button>
                  </div>
                ))}
                <Button variant="link" className="w-full" asChild>
                  <Link href={`/${lang}/student/my-courses`}>
                    {isAr ? "عرض كل الدورات" : "View All Courses"}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">
                  {isAr ? "لست مسجلاً في أي دورة بعد" : "You are not enrolled in any courses yet."}
                </p>
                <Button asChild variant="outline">
                  <Link href={`/${lang}/student/browse`}>
                    {isAr ? "تصفح الدورات" : "Browse Courses"}
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-1 lg:col-span-3 hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>{isAr ? "توصيات لك" : "Recommended for You"}</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
               <div className="p-4 rounded-full bg-muted/50">
                 <BookOpen className="h-8 w-8 text-muted-foreground" />
               </div>
               <div className="space-y-1">
                 <p className="font-medium">
                   {isAr ? "لا توجد توصيات حالياً" : "No recommendations yet"}
                 </p>
                 <p className="text-sm text-muted-foreground">
                   {isAr ? "سنقترح عليك دورات بناءً على اهتماماتك قريباً" : "We'll suggest courses based on your interests soon"}
                 </p>
               </div>
               <Button variant="outline" size="sm" asChild>
                  <Link href={`/${lang}/student/browse`}>
                    {isAr ? "استكشاف الدورات" : "Explore Courses"}
                  </Link>
               </Button>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
