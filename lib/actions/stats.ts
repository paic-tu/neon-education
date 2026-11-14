"use server"

import { db } from "@/lib/db"
import { certificates, courses, reviews, users } from "@/lib/db/schema"
import { and, avg, count, desc, eq, isNotNull, sql } from "drizzle-orm"

export async function getLandingPageStats() {
  try {
    const [[publishedCoursesResult], [studentsResult], [certificatesResult], [ratingResult], [reviewsCountResult]] = await Promise.all([
      db.select({ value: count() }).from(courses).where(eq(courses.isPublished, true)),
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(certificates),
      db.select({ value: avg(reviews.rating) }).from(reviews),
      db.select({ value: count() }).from(reviews).where(and(
        eq(reviews.isPublished, true),
        eq(reviews.rating, 5),
        isNotNull(reviews.comment),
        sql`length(${reviews.comment}) > 0`,
      )),
    ])
    const publishedCourseCount = publishedCoursesResult?.value || 0
    const totalReviews = reviewsCountResult?.value || 0

    // Default to 0 if no reviews
    const rawRating = ratingResult?.value ? Number(ratingResult.value) : 0
    const rawSatisfaction = rawRating ? Math.round((rawRating / 5) * 100) : 0

    return {
      courses: publishedCourseCount,
      students: studentsResult?.value || 0,
      certificates: certificatesResult?.value || 0,
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
      .limit(20)

    return rows
  } catch (error) {
    console.error("Error fetching landing page reviews:", error)
    return []
  }
}
