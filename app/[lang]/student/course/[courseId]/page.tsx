import { auth } from "@/lib/auth"
import { getCourseById, getEnrollment, getCourseLessons, checkEnrollmentStatus } from "@/lib/db/queries"
import { notFound, redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function StudentCourseEntryPage(props: { params: Promise<{ lang: string; courseId: string }> }) {
  const params = await props.params
  const { lang, courseId } = params

  const session = await auth()
  
  // 1. Validate Session
  if (!session?.user?.id) {
    redirect(`/${lang}/auth/login?callbackUrl=/${lang}/student/course/${courseId}`)
  }

  const userId = session.user.id
  const userRole = session.user.role

  // 2. Validate Role (Allow Admin/Instructor to view as student too, but primarily Student)
  if (userRole !== "student" && userRole !== "admin" && userRole !== "instructor") {
    return (
      <div className="container mx-auto py-10 text-center">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
        <Button asChild className="mt-4">
          <Link href={`/${lang}/`}>Go Home</Link>
        </Button>
      </div>
    )
  }

  // 3. Fetch Course & Enrollment
  const [course, enrollment, isEnrolledOk] = await Promise.all([
    getCourseById(courseId),
    getEnrollment(userId, courseId),
    checkEnrollmentStatus(userId, courseId),
  ])

  if (!course) {
    notFound()
  }

  // 4. Handle Not Enrolled / Not Paid
  if (!enrollment || (!isEnrolledOk && userRole === "student")) {
    if (userRole === "instructor" || userRole === "admin") {
       // Allow access without enrollment (preview mode)
       // Mock empty enrollment data if needed, or handle null downstream
    } else {
       // Redirect to public course page for enrollment
       redirect(`/${lang}/courses/${courseId}`)
    }
  }

  // 5. Determine Next Lesson
  const lessons = await getCourseLessons(courseId)

  if (!lessons || lessons.length === 0) {
    return (
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{lang === "ar" ? "قريباً" : "Coming Soon"}</CardTitle>
            <CardDescription>
              {lang === "ar" 
                ? "لم يتم إضافة دروس لهذه الدورة بعد." 
                : "No lessons have been added to this course yet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/${lang}/student/dashboard`}>
                {lang === "ar" ? "العودة للوحة التحكم" : "Back to Dashboard"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Parse completed lessons safely
  let completedLessonIds: string[] = []
  if (enrollment && enrollment.completedLessons) {
      completedLessonIds = enrollment.completedLessons as string[]
  }

  // Logic: Find the first lesson that is NOT completed
  // If all completed, go to the last lesson (or first)
  // Or if last_accessed_at is recent, maybe go to that one? (Simpler: First uncompleted)
  
  let nextLessonId = lessons[0].id

  // Sort lessons by order_index to be sure
  const sortedLessons = [...lessons].sort((a, b) => a.orderIndex - b.orderIndex)

  const firstUncompleted = sortedLessons.find(l => !completedLessonIds.includes(l.id))

  if (firstUncompleted) {
    nextLessonId = firstUncompleted.id
  } else {
    // All completed? Go to the last one or first one?
    // Let's go to the first one for review
    nextLessonId = sortedLessons[0].id
  }

  // 6. Redirect to Learning Player
  redirect(`/${lang}/student/learn/${courseId}/${nextLessonId}`)
}
