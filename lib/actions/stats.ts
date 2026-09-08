"use server"

import { getPlatformStats } from "@/lib/db/queries"
import { db } from "@/lib/db"
import { courses, reviews, users } from "@/lib/db/schema"
import { and, avg, count, desc, eq, isNotNull, sql } from "drizzle-orm"

export async function getLandingPageStats() {
  try {
    const stats = await getPlatformStats()

    // Only count courses the admin has approved/published for public visitors —
    // stats.course_count includes drafts, which is fine for the admin dashboard but not here.
    const [publishedCoursesResult] = await db
      .select({ value: count() })
      .from(courses)
      .where(eq(courses.isPublished, true))
    const publishedCourseCount = publishedCoursesResult?.value || 0

    // Fetch average rating for satisfaction
    const [ratingResult] = await db
      .select({ value: avg(reviews.rating) })
      .from(reviews)

    // Total published 5-star reviews with a comment, matching getLandingPageReviews' filter
    const [reviewsCountResult] = await db
      .select({ value: count() })
      .from(reviews)
      .where(
        and(
          eq(reviews.isPublished, true),
          eq(reviews.rating, 5),
          isNotNull(reviews.comment),
          sql`length(${reviews.comment}) > 0`
        )
      )
    const totalReviews = reviewsCountResult?.value || 0

    // Default to 0 if no reviews
    const rawRating = ratingResult?.value ? Number(ratingResult.value) : 0
    const rawSatisfaction = rawRating ? Math.round((rawRating / 5) * 100) : 0

    if (!stats) {
      return {
        courses: 0,
        students: 0,
        certificates: 0,
        satisfaction: 0,
        totalReviews
      }
    }

    return {
      courses: publishedCourseCount,
      students: stats.student_count,
      certificates: stats.certified_student_count,
      satisfaction: rawSatisfaction,
      totalReviews
    }
  } catch (error) {
    console.error("Error fetching landing page stats:", error)
    return {
      courses: 0,
      students: 0,
      certificates: 0,
      satisfaction: 0,
      totalReviews: 0
    }
  }
}

export async function getLandingPageReviews() {
  try {
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        userName: users.name,
        userAvatarUrl: users.avatarUrl,
        courseTitleAr: courses.titleAr,
        courseTitleEn: courses.titleEn,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .innerJoin(courses, eq(reviews.courseId, courses.id))
      .where(
        and(
          eq(reviews.isPublished, true),
          eq(reviews.rating, 5),
          isNotNull(reviews.comment),
          sql`length(${reviews.comment}) > 0`
        )
      )
      .orderBy(desc(reviews.createdAt))

    return rows
  } catch (error) {
    console.error("Error fetching landing page reviews:", error)
    return []
  }
}
