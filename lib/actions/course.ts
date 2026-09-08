"use server"

import { db } from "@/lib/db"
import { enrollments, progress, lessons, courses, conversations, conversationParticipants } from "@/lib/db/schema"
import { auth } from "@/lib/auth"
import { eq, and, count, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// --- Course Actions ---

export async function enrollAction(courseId: string) {
  console.log("[Action] enrollAction started", { courseId })
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      console.log("[Action] Unauthorized enrollment attempt")
      return { error: "Unauthorized" }
    }

    const userId = session.user.id

    const course = await db.query.courses.findFirst({
      where: eq(courses.id, courseId),
      columns: { id: true, isFree: true, price: true },
    })
    if (!course) return { error: "Course not found" }

    const priceNumber = Number.parseFloat(String(course.price))
    const isPaid = !course.isFree && Number.isFinite(priceNumber) && priceNumber > 0
    if (isPaid) {
      return { error: "Paid course requires checkout" }
    }

    // Check if already enrolled
    const existing = await db.query.enrollments.findFirst({
      where: and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId)
      )
    })

    if (existing) {
      return { success: true, alreadyEnrolled: true }
    }

    // Create enrollment
    await db.insert(enrollments).values({
      userId,
      courseId,
      status: "active",
      progress: 0,
      completedLessons: [],
    })

    // --- Add to Course Chat (Auto-Join) ---
    try {
      // 1. Check if a chat for this course already exists
      let courseChat = await db.query.conversations.findFirst({
        where: eq(conversations.courseId, courseId)
      })

      // 2. If not, create it
      if (!courseChat) {
        // Fetch course details for the name (using English title as requested) and instructor
        const course = await db.query.courses.findFirst({
          where: eq(courses.id, courseId),
          columns: { titleEn: true, instructorId: true }
        })

        if (course) {
          const [newChat] = await db.insert(conversations).values({
            type: "group",
            name: course.titleEn, // Use English title as requested
            courseId: courseId,
          }).returning()
          courseChat = newChat

          // Add Instructor to the chat automatically
          if (course.instructorId) {
            await db.insert(conversationParticipants).values({
              conversationId: newChat.id,
              userId: course.instructorId
            })
          }
        }
      }

      // 3. Add user to the chat if not already participating
      if (courseChat) {
        const existingParticipant = await db.query.conversationParticipants.findFirst({
          where: and(
            eq(conversationParticipants.conversationId, courseChat.id),
            eq(conversationParticipants.userId, userId)
          )
        })

        if (!existingParticipant) {
          await db.insert(conversationParticipants).values({
            conversationId: courseChat.id,
            userId: userId,
          })
          console.log(`[Action] User ${userId} auto-joined chat for course ${courseId}`)
        }
      }
    } catch (chatError) {
      console.error("Error auto-joining course chat:", chatError)
      // Non-blocking error, we still return success for enrollment
    }

    revalidatePath(`/courses/${courseId}`)
    revalidatePath(`/student/dashboard`)
    revalidatePath(`/ar/student/dashboard`)
    revalidatePath(`/en/student/dashboard`)
    revalidatePath(`/ar/student/my-courses`)
    revalidatePath(`/en/student/my-courses`)
    
    return { success: true }
  } catch (error) {
    console.error("Enrollment error:", error)
    return { error: "Failed to enroll" }
  }
}

export async function getInstructorCoursesAction() {
  console.log("[Action] getInstructorCoursesAction started")
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    const userId = session.user.id
    
    // Check if user is instructor or admin
    if (session.user.role !== "instructor" && session.user.role !== "admin") {
        return { error: "Unauthorized" }
    }

    const instructorCourses = await db.query.courses.findMany({
      where: eq(courses.instructorId, userId),
      orderBy: [desc(courses.createdAt)],
      columns: {
        id: true,
        titleEn: true,
        titleAr: true,
      }
    })

    return { courses: instructorCourses }
  } catch (error) {
    console.error("Get instructor courses error:", error)
    return { error: "Failed to fetch courses" }
  }
}

export async function getAllCoursesAction() {
  console.log("[Action] getAllCoursesAction started")
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "admin") {
      return { error: "Unauthorized" }
    }

    const allCourses = await db.query.courses.findMany({
      orderBy: [desc(courses.createdAt)],
      columns: {
        id: true,
        titleEn: true,
        titleAr: true,
      }
    })

    return { courses: allCourses }
  } catch (error) {
    console.error("Get all courses error:", error)
    return { error: "Failed to fetch courses" }
  }
}

export async function completeLessonAction(courseId: string, lessonId: string) {
  console.log("[Action] completeLessonAction started", { courseId, lessonId })
  try {
    const session = await auth()
    if (!session?.user?.id) {
      console.log("[Action] Unauthorized")
      return { error: "Unauthorized" }
    }

    const userId = session.user.id

    let enrollment = await db.query.enrollments.findFirst({
      where: and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId)
      )
    })

    if (!enrollment) {
      // If instructor or admin, auto-enroll them so they can track progress
      const role = (session.user as any).role
      if (role === "instructor" || role === "admin") {
          const [newEnrollment] = await db.insert(enrollments).values({
              userId,
              courseId,
              status: "active",
              progress: 0,
              completedLessons: [],
          }).returning()
          enrollment = newEnrollment
      } else {
          return { error: "Not enrolled" }
      }
    }

    // 1. Mark lesson as completed in progress table
    const existingProgress = await db.query.progress.findFirst({
      where: and(
        eq(progress.userId, userId),
        eq(progress.lessonId, lessonId)
      )
    })

    if (existingProgress) {
      await db.update(progress)
        .set({ 
          isCompleted: true, 
          progressPercentage: 100,
          lastAccessed: new Date()
        })
        .where(eq(progress.id, existingProgress.id))
    } else {
      await db.insert(progress).values({
        userId,
        lessonId,
        isCompleted: true,
        progressPercentage: 100,
      })
    }

    // 2. Recalculate Course Progress
    // Get all lessons for this course
    const courseLessons = await db.query.lessons.findMany({
      where: eq(lessons.courseId, courseId),
      columns: { id: true } // Only need IDs
    })

    const totalLessons = courseLessons.length

    // Get all completed lessons for this user in this course
    // We filter progress entries where lessonId is in courseLessons AND isCompleted is true
    const lessonIds = courseLessons.map(l => l.id)
    
    const completedProgressEntries = await db.query.progress.findMany({
      where: and(
        eq(progress.userId, userId),
        eq(progress.isCompleted, true)
        // We need to filter by lessons in this course. 
        // Drizzle doesn't support 'inArray' easily on relations in findMany without helper, 
        // but we can filter in JS if the set is small, or use raw SQL.
        // Given we have the lesson IDs, let's filter in memory or loop. 
        // Better: fetch progress for these specific lesson IDs.
      )
    })

    // Filter to only lessons in this course
    const completedLessonIds = completedProgressEntries
      .filter(p => lessonIds.includes(p.lessonId))
      .map(p => p.lessonId)

    const completedCount = completedLessonIds.length
    const progressPct = totalLessons > 0 
      ? Math.round((completedCount / totalLessons) * 100) 
      : 0

    // 3. Update Enrollment
    await db.update(enrollments)
      .set({ 
        completedLessons: completedLessonIds,
        progress: progressPct,
        lastAccessedAt: new Date()
      })
      .where(eq(enrollments.id, enrollment.id))

    revalidatePath(`/courses/${courseId}`)
    revalidatePath(`/student/course/${courseId}`)
    revalidatePath(`/student/learn/${courseId}/${lessonId}`)
    // Revalidate the entire learning path for this course to ensure next/prev lessons are updated
    revalidatePath('/[lang]/student/learn/[courseId]/[lessonId]', 'page')
    
    return { success: true, progress: progressPct }
  } catch (error) {
    console.error("Complete lesson error:", error)
    return { error: "Failed to complete lesson" }
  }
}

export async function deleteCourseAction(courseId: string, reason?: string) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user.role !== "instructor" && session.user.role !== "admin")) {
      return { error: "Unauthorized" }
    }

    if (session.user.role === "admin") {
      // Admin can hard-delete immediately
      const course = await db.query.courses.findFirst({
        where: eq(courses.id, courseId)
      })
      if (!course) return { error: "Course not found" }
      await db.delete(courses).where(eq(courses.id, courseId))
      revalidatePath("/instructor/courses")
      revalidatePath("/admin/courses")
      revalidatePath("/admin/course-reviews")
      return { success: true, mode: "hard-delete" as const }
    }

    // Instructor -> soft: request deletion (admin must approve first)
    const course = await db.query.courses.findFirst({
      where: and(eq(courses.id, courseId), eq(courses.instructorId, session.user.id))
    })
    if (!course) return { error: "Course not found or unauthorized" }

    if (course.deletionRequested) {
      return { error: "Deletion request already sent" }
    }

    await db.update(courses)
      .set({
        deletionRequested: true,
        deletionRequestedAt: new Date(),
        deletionRequestedReason: reason ? String(reason).slice(0, 1000) : null,
        deletionReviewedBy: null,
        deletionReviewedAt: null,
        deletionRejectedReason: null,
      })
      .where(eq(courses.id, courseId))

    revalidatePath("/instructor/courses")
    revalidatePath(`/instructor/courses/${courseId}/settings`)
    revalidatePath("/admin/course-reviews")
    return { success: true, mode: "requested" as const }
  } catch (error) {
    console.error("Delete course error:", error)
    return { error: "Failed to delete course" }
  }
}
