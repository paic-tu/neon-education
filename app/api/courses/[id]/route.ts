import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { courses, users, categories, lessons } from "@/lib/db/schema"
import { eq, asc } from "drizzle-orm"
import { auth } from "@/lib/auth"

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const courseId = params.id

    // Fetch course details with instructor and category
    const courseResult = await db
      .select({
        // Course fields
        id: courses.id,
        titleEn: courses.titleEn,
        titleAr: courses.titleAr,
        subtitleEn: courses.subtitleEn,
        subtitleAr: courses.subtitleAr,
        descriptionEn: courses.descriptionEn,
        descriptionAr: courses.descriptionAr,
        slug: courses.slug,
        thumbnailUrl: courses.thumbnailUrl,
        previewVideoUrl: courses.previewVideoUrl,
        instructorId: courses.instructorId,
        categoryId: courses.categoryId,
        difficulty: courses.difficulty,
        language: courses.language,
        duration: courses.duration,
        price: courses.price,
        isFree: courses.isFree,
        isPublished: courses.isPublished,
        tags: courses.tags,
        requirements: courses.requirements,
        learningOutcomes: courses.learningOutcomes,
        enrollmentCount: courses.enrollmentCount,
        rating: courses.rating,
        reviewsCount: courses.reviewsCount,
        createdAt: courses.createdAt,
        updatedAt: courses.updatedAt,

        // Joined fields
        instructor_name: users.name,
        instructor_bio: users.bio,
        category_name_en: categories.nameEn,
        category_name_ar: categories.nameAr,
      })
      .from(courses)
      .innerJoin(users, eq(courses.instructorId, users.id))
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(eq(courses.id, courseId))
      .limit(1)

    if (courseResult.length === 0) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const course = courseResult[0]

    // Fetch lessons
    const courseLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, courseId))
      .orderBy(asc(lessons.orderIndex))

    return NextResponse.json({ ...course, lessons: courseLessons })
  } catch (error) {
    console.error("[v0] Error fetching course:", error)
    return NextResponse.json({ error: "Failed to fetch course" }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id: courseId } = params
    const values = await req.json()

    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const course = await db.query.courses.findFirst({
      where: eq(courses.id, courseId),
    })

    if (!course) {
      return new NextResponse("Not found", { status: 404 })
    }

    if (course.instructorId !== session.user.id && session.user.role !== "admin") {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    await db.update(courses).set({
      ...values,
    }).where(eq(courses.id, courseId))

    return NextResponse.json(course)
  } catch (error) {
    console.log("[COURSE_ID_PATCH]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id: courseId } = params

    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const role = (session.user as any).role || "student"
    const isAdmin = role === "admin"

    // Attempt to extract optional body (for deletionRequestedReason passed by instructor)
    let body: any = {}
    try {
      body = await req.clone().json()
    } catch {
      // body is optional; many clients call DELETE without body
    }

    const course = await db.query.courses.findFirst({
      where: eq(courses.id, courseId),
    })

    if (!course) {
      return new NextResponse("Not found", { status: 404 })
    }

    if (course.instructorId !== session.user.id && !isAdmin) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (isAdmin) {
      // Admin can hard-delete immediately (bypasses workflow).
      // For the deletion-request workflow, use /api/courses/:id/deletion-review instead.
      await db.delete(courses).where(eq(courses.id, courseId))
      return NextResponse.json({ deleted: true, mode: "hard-delete" }, { status: 200 })
    }

    // Instructor: they cannot hard-delete. We *request* deletion; admin must approve.
    await db.update(courses)
      .set({
        deletionRequested: true,
        deletionRequestedAt: new Date(),
        deletionRequestedReason: body?.reason ? String(body.reason).slice(0, 1000) : null,
        deletionReviewedBy: null,
        deletionReviewedAt: null,
        deletionRejectedReason: null,
      })
      .where(eq(courses.id, courseId))

    return NextResponse.json(
      { deletionRequested: true, mode: "requested" },
      { status: 202 }
    )
  } catch (error) {
    console.log("[COURSE_ID_DELETE]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
