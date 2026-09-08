"use server"

import { and, desc, eq, count, sql, inArray, asc, getTableColumns, sum, not, or, isNull, aliasedTable } from "drizzle-orm"
import { db } from "@/lib/db"
import { 
  courses, enrollments, lessons, notes, users, bookmarks, modules, progress, 
  carts, cartItems, products, orders, orderItems, reviews,
  certificates, challenges, contests, categories, challengeSubmissions, contestParticipants,
  cohorts, cohortMembers, cohortCourses, cohortSchedule, cohortAnnouncements,
  mentors, bookings, bookingReviews, mentorAvailability, siteSettings
} from "@/lib/db/schema"
import { revalidatePath } from "next/cache"

// Courses — PUBLIC catalog: only courses that are published AND approved by an admin.
// Instructors' own courses (including pending/approved/rejected status) still appear in their own dashboard via getInstructorCourses().
export async function getAllCourses() {
  try {
    const allCourses = await db.query.courses.findMany({
      where: and(
        eq(courses.isPublished, true),
        eq(courses.isApproved, true),
        eq(courses.deletionRequested, false)
      ),
      with: {
        instructor: true,
        category: true,
      },
      orderBy: [desc(courses.createdAt)],
    })

    return allCourses.map(c => ({
      ...c,
      instructor_name: c.instructor.name,
      category_name_en: c.category?.nameEn,
      category_name_ar: c.category?.nameAr,
    }))
  } catch (error) {
    console.error("[v0] Error fetching courses:", error)
    return []
  }
}

export async function getCourseById(courseId: string) {
  try {
    if (!courseId) {
      console.warn("getCourseById called with empty courseId")
      return null
    }

    // Split query to avoid complexity issues
    const course = await db.query.courses.findFirst({
      where: eq(courses.id, courseId),
      with: {
        instructor: true,
        category: true,
      },
    })

    if (!course) return null

    const courseModules = await db.query.modules.findMany({
      where: eq(modules.courseId, courseId),
      orderBy: [asc(modules.orderIndex)],
      with: {
        lessons: {
          orderBy: [asc(lessons.orderIndex)],
        },
      },
    })

    return {
      ...course,
      modules: courseModules
    }
  } catch (error) {
    console.error("Error fetching course:", error)
    return null
  }
}

export async function getCourseContent(courseId: string) {
  return getCourseById(courseId)
}

export async function getLessonById(id: string) {
  try {
    const lesson = await db.query.lessons.findFirst({
      where: eq(lessons.id, id),
      with: {
        module: {
          with: {
            course: true
          }
        }
      }
    })
    return lesson
  } catch (error) {
    console.error("Error fetching lesson:", error)
    return null
  }
}

export async function getCourseModules(courseId: string) {
  try {
    return await db.query.modules.findMany({
      where: eq(modules.courseId, courseId),
      orderBy: [asc(modules.orderIndex)],
      with: {
        lessons: {
          orderBy: [asc(lessons.orderIndex)],
        },
      },
    })
  } catch (error) {
    console.error("Error fetching course modules:", error)
    return []
  }
}


export async function getCourseLessons(courseId: string) {
  try {
    return await db.query.lessons.findMany({
      where: eq(lessons.courseId, courseId),
      orderBy: [asc(lessons.orderIndex)],
      with: {
        module: true
      }
    })
  } catch (error) {
    console.error("Error fetching course lessons:", error)
    return []
  }
}

export async function getInstructors() {
  try {
    return await db.query.users.findMany({
      where: inArray(users.role, ["instructor", "admin"]),
    })
  } catch (error) {
    console.error("Error fetching instructors:", error)
    return []
  }
}

export async function getInstructorCourses(instructorId: string) {
  try {
    const instructorCourses = await db.query.courses.findMany({
      where: and(
        eq(courses.instructorId, instructorId),
        eq(courses.deletionRequested, false)
      ),
      orderBy: [desc(courses.createdAt)],
      with: {
        category: true,
      }
    })

    return await Promise.all(
      instructorCourses.map(async (course) => {
        const enrollmentCount = await db
          .select({ count: count() })
          .from(enrollments)
          .where(eq(enrollments.courseId, course.id))
          .then((res) => res[0].count)

        return { ...course, enrollmentCount }
      })
    )
  } catch (error) {
    console.error("Error fetching instructor courses:", error)
    return []
  }
}

// --- Admin Moderation / Approval ---
// Fetches all courses that need admin review.
// Pending = not approved yet AND not explicitly rejected (no approvalNote + isApproved=false).
// Also returns Approved + Rejected for history view + deletion requested courses.
// Uses a users alias (requester_users) because the same users table is joined for "instructor" as well.
const requesterUsers = aliasedTable(users, "requester_users")

export async function getAdminCoursesForReview() {
  try {
    const rows = await db
      .select({
        id: courses.id,
        titleAr: courses.titleAr,
        titleEn: courses.titleEn,
        slug: courses.slug,
        thumbnailUrl: courses.thumbnailUrl,
        isPublished: courses.isPublished,
        isLive: courses.isLive,
        price: courses.price,
        isFree: courses.isFree,
        createdAt: courses.createdAt,
        updatedAt: courses.updatedAt,
        isApproved: courses.isApproved,
        approvedAt: courses.approvedAt,
        approvalNote: courses.approvalNote,
        deletionRequested: courses.deletionRequested,
        deletionRequestedAt: courses.deletionRequestedAt,
        deletionRequestedReason: courses.deletionRequestedReason,
        deletionReviewedAt: courses.deletionReviewedAt,
        deletionRejectedReason: courses.deletionRejectedReason,
        instructorId: courses.instructorId,
        instructorName: users.name,
        instructorEmail: users.email,
        approvedByName: requesterUsers.name,
        categoryNameAr: categories.nameAr,
        categoryNameEn: categories.nameEn,
      })
      .from(courses)
      .innerJoin(users, eq(courses.instructorId, users.id))
      .leftJoin(requesterUsers, eq(courses.approvedBy, requesterUsers.id))
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .orderBy(desc(courses.createdAt))

    return rows
  } catch (error) {
    console.error("Error fetching admin courses for review:", error)
    return []
  }
}

export async function getUserOrders(userId: string) {
  try {
    const userOrders = await db.query.orders.findMany({
      where: eq(orders.userId, userId),
      with: {
        items: {
          with: {
            product: true,
            course: true
          }
        }
      },
      orderBy: [desc(orders.createdAt)]
    })
    return userOrders
  } catch (error) {
    console.error("Error fetching user orders:", error)
    return []
  }
}

export async function getCourseQuizzes(courseId: string, instructorId?: string) {
  try {
    const conditions = [eq(challenges.type, "quiz")]
    
    if (instructorId) {
      conditions.push(
        or(
          eq(challenges.courseId, courseId),
          and(isNull(challenges.courseId), eq(challenges.instructorId, instructorId))
        )!
      )
    } else {
      conditions.push(eq(challenges.courseId, courseId))
    }

    return await db.query.challenges.findMany({
      where: and(...conditions),
      orderBy: [desc(challenges.createdAt)],
    })
  } catch (error) {
    console.error("Error fetching course quizzes:", error)
    return []
  }
}

export async function getQuizById(quizId: string) {
  try {
    const quiz = await db.query.challenges.findFirst({
      where: eq(challenges.id, quizId),
    })
    return quiz
  } catch (error) {
    console.error("Error fetching quiz:", error)
    return null
  }
}

export async function getQuizSubmission(challengeId: string, userId: string) {
  try {
    const submission = await db.query.challengeSubmissions.findFirst({
      where: and(
        eq(challengeSubmissions.challengeId, challengeId),
        eq(challengeSubmissions.userId, userId)
      ),
      orderBy: [desc(challengeSubmissions.submittedAt)]
    })
    return submission
  } catch (error) {
    console.error("Error fetching quiz submission:", error)
    return null
  }
}

export async function getInstructorStats(instructorId: string) {
  try {
    const coursesCount = await db
      .select({ count: count() })
      .from(courses)
      .where(eq(courses.instructorId, instructorId))
      .then(res => res[0].count)

    const studentsCount = await db
      .select({ count: count() })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(courses.instructorId, instructorId))
      .then(res => res[0].count)

    const reviewsCount = await db
      .select({ count: count() })
      .from(reviews)
      .innerJoin(courses, eq(reviews.courseId, courses.id))
      .where(eq(courses.instructorId, instructorId))
      .then(res => res[0].count)

    const avgRating = await db
      .select({ avg: sql`AVG(${reviews.rating})` })
      .from(reviews)
      .innerJoin(courses, eq(reviews.courseId, courses.id))
      .where(eq(courses.instructorId, instructorId))
      .then(res => Number(res[0]?.avg || 0).toFixed(1))

    const avgInstructorRating = await db
      .select({ avg: sql`AVG(${reviews.instructorRating})` })
      .from(reviews)
      .innerJoin(courses, eq(reviews.courseId, courses.id))
      .where(eq(courses.instructorId, instructorId))
      .then(res => Number(res[0]?.avg || 0).toFixed(1))

    return {
      courses: coursesCount,
      students: studentsCount,
      reviews: reviewsCount,
      rating: avgRating,
      instructorRating: avgInstructorRating
    }
  } catch (error) {
    console.error("Error fetching instructor stats:", error)
    return {
      courses: 0,
      students: 0,
      reviews: 0,
      rating: "0.0",
      instructorRating: "0.0"
    }
  }
}

// User Profile
export async function getUserProfile(userId: string) {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })
    return user
  } catch (error) {
    console.error("Error fetching user profile:", error)
    return null
  }
}

export async function getStudentDashboardData(userId: string) {
  try {
    const [enrolledCourses, certsCount, user] = await Promise.all([
      db.query.enrollments.findMany({
        where: eq(enrollments.userId, userId),
        with: {
          course: {
            with: {
              instructor: true,
              category: true,
            }
          }
        },
        orderBy: [desc(enrollments.lastAccessedAt)]
      }),
      db.select({ count: count() })
        .from(certificates)
        .where(eq(certificates.userId, userId))
        .then(res => res[0].count),
      db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          points: true
        }
      })
    ])

    const completedCourses = enrolledCourses.filter(e => e.progress === 100).length
    const activeCourses = enrolledCourses.length - completedCourses
    
    // Last activity logic
    let lastActivity = null
    const lastActiveEnrollment = enrolledCourses.find(e => e.progress < 100)
    
    if (lastActiveEnrollment) {
        const courseLessons = await db.query.lessons.findMany({
            where: eq(lessons.courseId, lastActiveEnrollment.courseId),
            orderBy: [asc(lessons.orderIndex)],
            columns: {
                id: true,
                titleEn: true,
                titleAr: true,
                orderIndex: true
            }
        })
        
        const completedLessonIds = lastActiveEnrollment.completedLessons as string[] || []
        const nextLesson = courseLessons.find(l => !completedLessonIds.includes(l.id)) || courseLessons[courseLessons.length - 1]
        
        if (nextLesson) {
            lastActivity = {
                courseTitleAr: lastActiveEnrollment.course.titleAr,
                courseTitleEn: lastActiveEnrollment.course.titleEn,
                lessonTitleAr: nextLesson.titleAr,
                lessonTitleEn: nextLesson.titleEn,
                progress: lastActiveEnrollment.progress,
                courseId: lastActiveEnrollment.courseId,
                lessonId: nextLesson.id
            }
        }
    }

    // Live now, scoped to this student's own enrolled courses only
    const liveCourses = enrolledCourses
      .filter((e) => e.course?.isStreaming)
      .map((e) => ({
        courseId: e.courseId,
        titleEn: e.course.titleEn,
        titleAr: e.course.titleAr,
      }))

    return {
      stats: {
        activeCourses,
        completedCourses,
        certificates: certsCount,
        totalPoints: user?.points || 0
      },
      enrolledCourses,
      lastActivity,
      liveCourses
    }
  } catch (error) {
    console.error("Error fetching student dashboard data:", error)
    return {
      stats: {
        activeCourses: 0,
        completedCourses: 0,
        certificates: 0,
        totalPoints: 0
      },
      enrolledCourses: [],
      lastActivity: null,
      liveCourses: []
    }
  }
}

export async function getAllStoreItems() {
  try {
    return await db.query.products.findMany({
      where: eq(products.isActive, true),
      with: {
        category: true
      },
      orderBy: [desc(products.createdAt)]
    })
  } catch (error) {
    console.error("Error fetching store items:", error)
    return []
  }
}

export async function getAllContests() {
  try {
    return await db.query.contests.findMany({
      orderBy: [desc(contests.startDate)]
    })
  } catch (error) {
    console.error("Error fetching contests:", error)
    return []
  }
}

export async function getContestById(id: string) {
  try {
    return await db.query.contests.findFirst({
      where: eq(contests.id, id)
    })
  } catch (error) {
    console.error("Error fetching contest:", error)
    return null
  }
}

export async function joinContest(contestId: string, userId: string) {
  try {
    // Check if already joined
    const existing = await db.query.contestParticipants.findFirst({
      where: and(
        eq(contestParticipants.contestId, contestId),
        eq(contestParticipants.userId, userId)
      )
    })

    if (existing) return { success: true }

    await db.insert(contestParticipants).values({
      contestId,
      userId,
      joinedAt: new Date()
    })
    return { success: true }
  } catch (error) {
    console.error("Error joining contest:", error)
    return { success: false, error: "Failed to join contest" }
  }
}

async function hasPaidOrderForCourse(userId: string, courseId: string) {
  const rows = await db
    .select({ c: count() })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        inArray(orders.status, ["paid", "shipped", "delivered"]),
        eq(orderItems.courseId, courseId),
      ),
    )
  return (rows[0]?.c ?? 0) > 0
}

export async function checkEnrollmentStatus(userId: string, courseId: string) {
  try {
    const [course, enrollment] = await Promise.all([
      db.query.courses.findFirst({ where: eq(courses.id, courseId), columns: { isFree: true, price: true } }),
      getEnrollment(userId, courseId),
    ])

    if (!course) return false
    if (!enrollment) return false

    if (course.isFree) return true

    const priceNumber = Number.parseFloat(String(course.price))
    const isPaidCourse = Number.isFinite(priceNumber) && priceNumber > 0
    if (!isPaidCourse) return true

    return await hasPaidOrderForCourse(userId, courseId)
  } catch (error) {
    return false
  }
}

export async function getCategoryById(id: string) {
  try {
    return await db.query.categories.findFirst({
      where: eq(categories.id, id)
    })
  } catch (error) {
    console.error("Error fetching category:", error)
    return null
  }
}

export async function getContestParticipants(contestId: string) {
  try {
    return await db.query.contestParticipants.findMany({
      where: eq(contestParticipants.contestId, contestId),
      with: {
        user: true
      }
    })
  } catch (error) {
    console.error("Error fetching contest participants:", error)
    return []
  }
}

export async function getInstructorDashboardData(instructorId: string) {
  const stats = await getInstructorStats(instructorId)
  const recentCourses = await getInstructorCourses(instructorId)
  
  // Get recent enrollments
  const recentEnrollments = await db
    .select({
      id: enrollments.id,
      user: users,
      course: courses,
      createdAt: enrollments.createdAt,
      progress: enrollments.progress
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .innerJoin(users, eq(enrollments.userId, users.id))
    .where(eq(courses.instructorId, instructorId))
    .orderBy(desc(enrollments.createdAt))
    .limit(5)

  return {
    stats,
    recentCourses: recentCourses.slice(0, 5),
    recentEnrollments: recentEnrollments.map(e => ({
      id: e.id,
      studentName: e.user.name,
      studentAvatar: e.user.avatarUrl,
      courseName: e.course.titleEn, // Or handle locale
      progress: e.progress,
      date: e.createdAt
    }))
  }
}

export async function getAllCategories() {
  try {
    return await db.query.categories.findMany({
      orderBy: [asc(categories.nameEn)]
    })
  } catch (error) {
    console.error("Error fetching categories:", error)
    return []
  }
}

export async function getCourseEnrollments(courseId: string) {
  try {
    const courseEnrollments = await db.query.enrollments.findMany({
      where: eq(enrollments.courseId, courseId),
      with: {
        user: true
      },
      orderBy: [desc(enrollments.createdAt)]
    })
    return courseEnrollments
  } catch (error) {
    console.error("Error fetching course enrollments:", error)
    return []
  }
}

export async function getEnrollment(userId: string, courseId: string) {
  try {
    const enrollment = await db.query.enrollments.findFirst({
      where: and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId)
      ),
    })
    return enrollment
  } catch (error) {
    console.error("Error fetching enrollment:", error)
    return null
  }
}

export async function getStudentCourses(userId: string) {
  try {
    const studentEnrollments = await db.query.enrollments.findMany({
      where: eq(enrollments.userId, userId),
      with: {
        course: {
          with: {
            instructor: true,
            category: true,
          }
        }
      },
      orderBy: [desc(enrollments.createdAt)],
    })
    return studentEnrollments
  } catch (error) {
    console.error("Error fetching student courses:", error)
    return []
  }
}

// Reviews
export async function getInstructorReviews(instructorId: string) {
  try {
    const result = await db
      .select({
        review: reviews,
        user: users,
        course: courses
      })
      .from(reviews)
      .innerJoin(courses, eq(reviews.courseId, courses.id))
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(eq(courses.instructorId, instructorId))
      .orderBy(desc(reviews.createdAt))
      
    return result.map(r => ({
      ...r.review,
      user: r.user,
      course: r.course
    }))
  } catch (error) {
    console.error("Error fetching instructor reviews:", error)
    return []
  }
}

export async function getAllReviews() {
  try {
    const result = await db.query.reviews.findMany({
      with: {
        user: true,
        course: {
          with: {
            instructor: true
          }
        }
      },
      orderBy: [desc(reviews.createdAt)],
    })
    return result
  } catch (error) {
    console.error("Error fetching all reviews:", error)
    return []
  }
}

// Bookmarks
export async function getUserBookmarks(userId: string) {
  try {
    const userBookmarks = await db.query.bookmarks.findMany({
      where: eq(bookmarks.userId, userId),
      with: {
        course: {
          with: {
            instructor: true,
            category: true,
          }
        }
      },
      orderBy: [desc(bookmarks.createdAt)]
    })
    return userBookmarks
  } catch (error) {
    console.error("Error fetching user bookmarks:", error)
    return []
  }
}

export async function isBookmarked(userId: string, courseId: string) {
  try {
    const bookmark = await db.query.bookmarks.findFirst({
      where: and(
        eq(bookmarks.userId, userId),
        eq(bookmarks.courseId, courseId)
      )
    })
    return !!bookmark
  } catch (error) {
    return false
  }
}

export async function toggleBookmark(userId: string, courseId: string) {
  try {
    const existing = await isBookmarked(userId, courseId)
    if (existing) {
      await db.delete(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.courseId, courseId)))
      return false // Removed
    } else {
      await db.insert(bookmarks).values({ userId, courseId })
      return true // Added
    }
  } catch (error) {
    console.error("Error toggling bookmark:", error)
    throw error
  }
}

// Certificates
export async function getUserCertificates(userId: string) {
  try {
    return await db.query.certificates.findMany({
      where: eq(certificates.userId, userId),
      with: {
        course: {
          with: {
            instructor: {
              columns: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [desc(certificates.issuedAt)]
    })
  } catch (error) {
    console.error("Error fetching certificates:", error)
    return []
  }
}

// Notes
export async function createNote(userId: string, lessonId: string, content: string, timestamp?: number) {
  try {
    const [note] = await db.insert(notes).values({
      userId,
      lessonId,
      content,
      timestamp
    }).returning()
    return note
  } catch (error) {
    console.error("Error creating note:", error)
    return null
  }
}

export async function deleteNote(noteId: string, userId: string) {
   try {
     await db.delete(notes).where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
     return true
   } catch (error) {
     console.error("Error deleting note:", error)
     return false
   }
}

export async function getUserNotes(userId: string) {
  try {
    const userNotes = await db
      .select({
        id: notes.id,
        content: notes.content,
        createdAt: notes.createdAt,
        timestamp: notes.timestamp,
        lessonId: notes.lessonId,
        lessonTitleEn: lessons.titleEn,
        lessonTitleAr: lessons.titleAr,
        courseId: lessons.courseId,
        courseTitleEn: courses.titleEn,
        courseTitleAr: courses.titleAr,
      })
      .from(notes)
      .innerJoin(lessons, eq(notes.lessonId, lessons.id))
      .innerJoin(courses, eq(lessons.courseId, courses.id))
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.createdAt))
      
    return userNotes
  } catch (error) {
    console.error("Error fetching user notes:", error)
    return []
  }
}

export async function getUserCourseNotes(userId: string, courseId: string) {
  try {
    const courseNotes = await db
      .select({
        id: notes.id,
        content: notes.content,
        createdAt: notes.createdAt,
        timestamp: notes.timestamp,
        lessonId: notes.lessonId,
        lessonTitleEn: lessons.titleEn,
        lessonTitleAr: lessons.titleAr,
      })
      .from(notes)
      .innerJoin(lessons, eq(notes.lessonId, lessons.id))
      .where(and(eq(notes.userId, userId), eq(lessons.courseId, courseId)))
      .orderBy(desc(notes.createdAt))

    return courseNotes
  } catch (error) {
    console.error("Error fetching course notes:", error)
    return []
  }
}

export async function getUserLessonNotes(userId: string, lessonId: string) {
  try {
    return await db.query.notes.findMany({
      where: and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)),
      orderBy: [desc(notes.createdAt)]
    })
  } catch (error) {
    console.error("Error fetching notes:", error)
    return []
  }
}

// Learning Data
export async function getLearningData(userId: string, courseId: string, lessonId: string, role?: string) {
  try {
     // Run queries in parallel
     const [course, courseModules, enrollment, currentLesson] = await Promise.all([
       // 1. Get Course Basic Info
       db.query.courses.findFirst({
         where: eq(courses.id, courseId),
         with: {
           instructor: true,
           category: true,
         },
       }),
       
       // 2. Get Course Modules with Lightweight Lessons (Metadata only)
       db.query.modules.findMany({
         where: eq(modules.courseId, courseId),
         orderBy: [asc(modules.orderIndex)],
         with: {
           lessons: {
             orderBy: [asc(lessons.orderIndex)],
             columns: {
               id: true,
               titleEn: true,
               titleAr: true,
               slug: true,
               durationMinutes: true,
               orderIndex: true,
               type: true,
               moduleId: true,
               courseId: true,
               isPreview: true,
               status: true
             }
           },
         },
       }),

       // 3. Get Enrollment
       getEnrollment(userId, courseId),

       // 4. Get Current Lesson (Full details)
       getLessonById(lessonId)
     ])

     if (!course) return { error: "Course not found" }
     
     // Combine course and modules
     const fullCourse = {
       ...course,
       modules: courseModules
     }

     if (role !== "instructor" && role !== "admin") {
       if (!enrollment) {
         return { error: "Not enrolled" }
       }

       const priceNumber = Number.parseFloat(String(course.price))
       const isPaidCourse = !course.isFree && Number.isFinite(priceNumber) && priceNumber > 0
       if (isPaidCourse) {
         const ok = await hasPaidOrderForCourse(userId, courseId)
         if (!ok) {
           return { error: "Not enrolled" }
         }
       }
     }
     
     // Calculate navigation
     // @ts-ignore
     const allLessons = courseModules?.flatMap((m: any) => m.lessons) || []
     // @ts-ignore
     const currentIndex = allLessons.findIndex((l: any) => l.id === lessonId)
     const prev = currentIndex > 0 ? allLessons[currentIndex - 1] : null
     const next = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

     return {
       course: fullCourse,
       // @ts-ignore
       courseContent: courseModules || [],
       enrollment,
       currentLesson,
       userProgress: {
         progress: enrollment?.progress || 0,
         completedLessons: enrollment?.completedLessons || []
       },
       navigation: {
         prev,
         next
       }
     }
  } catch (error) {
    console.error("Error fetching learning data:", error)
    return { error: "Internal server error" }
  }
}

// Stats
export async function getPlatformStats() {
  try {
    const course_count = await db.select({ count: count() }).from(courses).then(res => res[0].count)
    const student_count = await db.select({ count: count() }).from(users).then(res => res[0].count)
    const enrollment_count = await db.select({ count: count() }).from(enrollments).then(res => res[0].count)
    const certified_student_count = await db.select({ count: count() }).from(certificates).then(res => res[0].count)
    const challenge_count = await db.select({ count: count() }).from(challenges).then(res => res[0].count)
    const contest_count = await db.select({ count: count() }).from(contests).then(res => res[0].count)
    
    return { 
      course_count, 
      student_count, 
      enrollment_count,
      certified_student_count,
      challenge_count,
      contest_count
    }
  } catch (error) {
    console.error("Error fetching platform stats:", error)
    return {
      course_count: 0,
      student_count: 0,
      enrollment_count: 0,
      certified_student_count: 0,
      challenge_count: 0,
      contest_count: 0
    }
  }
}

export async function getInstructorAnalytics(instructorId: string) {
  try {
    const stats = await getInstructorStats(instructorId)
    
    // Calculate total revenue (approximate based on enrollments * price)
    // In a real app, use orders table
    const courses = await getInstructorCourses(instructorId)
    let totalRevenue = 0
    
    for (const course of courses) {
      const enrollmentCount = await db
        .select({ count: count() })
        .from(enrollments)
        .where(eq(enrollments.courseId, course.id))
        .then(res => res[0].count)
        
      totalRevenue += enrollmentCount * Number(course.price || 0)
    }

    return {
      totalStudents: stats.students,
      totalCourses: stats.courses,
      totalReviews: stats.reviews,
      rating: stats.rating,
      instructorRating: stats.instructorRating,
      totalRevenue: totalRevenue || 0
    }
  } catch (error) {
    console.error("Error fetching instructor analytics:", error)
    return {
      totalStudents: 0,
      totalCourses: 0,
      totalReviews: 0,
      rating: "0.0",
      instructorRating: "0.0",
      totalRevenue: 0
    }
  }
}

export async function getInstructorCoursePerformance(instructorId: string) {
  try {
    const instructorCourses = await getInstructorCourses(instructorId)
    
    const performanceData = await Promise.all(instructorCourses.map(async (course) => {
      const enrollmentCount = await db
        .select({ count: count() })
        .from(enrollments)
        .where(eq(enrollments.courseId, course.id))
        .then(res => res[0].count)

      const avgRating = await db
        .select({ avg: sql`AVG(${reviews.rating})` })
        .from(reviews)
        .where(eq(reviews.courseId, course.id))
        .then(res => Number(res[0]?.avg || 0).toFixed(1))

      return {
        ...course,
        enrollment_count: enrollmentCount,
        revenue: enrollmentCount * Number(course.price || 0),
        rating: avgRating
      }
    }))

    return performanceData.sort((a, b) => b.revenue - a.revenue)
  } catch (error) {
    console.error("Error fetching instructor course performance:", error)
    return []
  }
}

export async function getAllCohorts() {
  try {
    return await db.query.cohorts.findMany({
      with: {
        creator: true,
        members: true
      },
      orderBy: [desc(cohorts.startsAt)]
    })
  } catch (error) {
    console.error("Error fetching cohorts:", error)
    return []
  }
}

export async function getCohortById(cohortId: string) {
  try {
    return await db.query.cohorts.findFirst({
      where: eq(cohorts.id, cohortId),
      with: {
        creator: true,
        members: {
          with: {
            user: true
          }
        },
        courses: {
          with: {
            course: true
          }
        },
        schedule: true,
        announcements: {
            with: {
                author: true
            },
            orderBy: [desc(cohortAnnouncements.createdAt)]
        }
      }
    })
  } catch (error) {
    console.error("Error fetching cohort:", error)
    return null
  }
}

export async function joinCohort(cohortId: string, userId: string) {
  try {
    // Check if already a member
    const existingMember = await db.query.cohortMembers.findFirst({
      where: and(
        eq(cohortMembers.cohortId, cohortId),
        eq(cohortMembers.userId, userId)
      )
    })

    if (existingMember) {
      return { success: false, error: "Already a member", status: existingMember.role }
    }

    // Check capacity
    const cohort = await db.query.cohorts.findFirst({
        where: eq(cohorts.id, cohortId),
        with: {
            members: true
        }
    })

    if (!cohort) return { success: false, error: "Cohort not found" }
    
    // Check if cohort is full
    if (cohort.capacity && cohort.members.length >= cohort.capacity) {
        return { success: false, error: "Cohort is full" }
    }

    await db.insert(cohortMembers).values({
      cohortId,
      userId,
      role: "student",
      joinedAt: new Date()
    })

    return { success: true, status: "student" }
  } catch (error) {
    console.error("Error joining cohort:", error)
    return { success: false, error: "Failed to join cohort" }
  }
}

export async function getMentorById(mentorId: string) {
  try {
    return await db.query.mentors.findFirst({
      where: eq(mentors.id, mentorId),
      with: {
        user: true,
        availability: true,
        bookings: {
           with: {
             review: true
           }
        }
      }
    })
  } catch (error) {
    console.error("Error fetching mentor:", error)
    return null
  }
}

export async function createBooking(studentId: string, mentorId: string, startAt: Date, endAt: Date, topic: string, notes?: string) {
  try {
    const [booking] = await db.insert(bookings).values({
      studentId,
      mentorId,
      startAt,
      endAt,
      topic,
      notes,
      status: "requested"
    }).returning()
    return booking
  } catch (error) {
    console.error("Error creating booking:", error)
    throw error
  }
}

export async function getUserBookings(userId: string, role: "student" | "mentor" = "student") {
  try {
    let actualWhereClause
    
    if (role === "mentor") {
        const mentorRecord = await db.query.mentors.findFirst({
            where: eq(mentors.userId, userId)
        })
        if (!mentorRecord) return []
        actualWhereClause = eq(bookings.mentorId, mentorRecord.id)
    } else {
        actualWhereClause = eq(bookings.studentId, userId)
    }

    return await db.query.bookings.findMany({
      where: actualWhereClause,
      with: {
        mentor: {
          with: { user: true }
        },
        student: true
      },
      orderBy: [desc(bookings.startAt)]
    })
  } catch (error) {
    console.error("Error fetching user bookings:", error)
    return []
  }
}

export async function updateBookingStatus(bookingId: string, status: "confirmed" | "completed" | "cancelled" | "requested", meetingUrl?: string) {
  try {
    const updateData: any = { status, updatedAt: new Date() }
    if (meetingUrl) updateData.meetingUrl = meetingUrl

    const [updated] = await db.update(bookings)
      .set(updateData)
      .where(eq(bookings.id, bookingId))
      .returning()
    return updated
  } catch (error) {
    console.error("Error updating booking status:", error)
    throw error
  }
}

// Renamed functions for Lesson Quizzes
export async function getLessonQuiz(lessonId: string) {
  try {
    const lesson = await db.query.lessons.findFirst({
      where: eq(lessons.id, lessonId)
    })
    
    if (lesson && lesson.quizConfig) {
      return lesson.quizConfig
    }
    
    return null
  } catch (error) {
    console.error("Error fetching lesson quiz:", error)
    return null
  }
}

export async function getLessonQuizSubmission(lessonId: string, userId: string) {
  try {
    const userProgress = await db.query.progress.findFirst({
        where: and(
            eq(progress.lessonId, lessonId),
            eq(progress.userId, userId)
        )
    })

    if (userProgress && userProgress.isCompleted) {
        return {
            id: "submission-" + userProgress.id,
            quizId: lessonId,
            userId: userId,
            score: 100, // Mock score
            passed: true,
            completedAt: userProgress.lastAccessed
        }
    }
    return null
  } catch (error) {
    console.error("Error fetching lesson quiz submission:", error)
    return null
  }
}


export async function getAllMentors() {
  try {
    return await db.query.mentors.findMany({
      with: {
        user: true,
        availability: true,
        bookings: {
          with: {
            review: true
          }
        }
      }
    })
  } catch (error) {
    console.error("Error fetching mentors:", error)
    return []
  }
}

export async function updateUserProfile(userId: string, data: Partial<typeof users.$inferInsert>) {
  try {
    const [updated] = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning()
    return updated
  } catch (error) {
    console.error("Error updating user profile:", error)
    throw error
  }
}

export async function createCategory(data: typeof categories.$inferInsert) {
  try {
    const [category] = await db.insert(categories).values(data).returning()
    return category
  } catch (error) {
    console.error("Error creating category:", error)
    throw error
  }
}

export async function updateCategory(id: string, data: Partial<typeof categories.$inferInsert>) {
  try {
    const [updated] = await db.update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning()
    return updated
  } catch (error) {
    console.error("Error updating category:", error)
    throw error
  }
}

export async function deleteCategory(id: string) {
  try {
    await db.delete(categories).where(eq(categories.id, id))
    return true
  } catch (error) {
    console.error("Error deleting category:", error)
    throw error
  }
}

// Site Settings
export async function getSiteSettings() {
  try {
    const row = await db.query.siteSettings.findFirst({
      where: eq(siteSettings.id, "global"),
    })
    return row ?? {
      id: "global",
      siteName: "Neon Educational Platform",
      supportEmail: "support@neon.edu",
      maintenanceMode: false,
      allowRegistration: true,
      currency: "SAR",
      email: { notifications: true },
      features: { showStore: true, showMentors: true, enableLive: true },
    }
  } catch (e) {
    return {
      id: "global",
      siteName: "Neon Educational Platform",
      supportEmail: "support@neon.edu",
      maintenanceMode: false,
      allowRegistration: true,
      currency: "SAR",
      email: { notifications: true },
      features: { showStore: true, showMentors: true, enableLive: true },
    }
  }
}

export async function updateSiteSettings(values: {
  siteName: string
  supportEmail: string
  maintenanceMode: boolean
  allowRegistration: boolean
  currency: string
  email: { smtpHost?: string; smtpPort?: number; smtpUser?: string; smtpPassword?: string; notifications?: boolean }
  features: { showStore?: boolean; showMentors?: boolean; enableLive?: boolean }
}) {
  try {
    await db
      .insert(siteSettings)
      .values({
        id: "global",
        siteName: values.siteName,
        supportEmail: values.supportEmail,
        maintenanceMode: values.maintenanceMode,
        allowRegistration: values.allowRegistration,
        currency: values.currency,
        email: values.email,
        features: values.features,
      })
      .onConflictDoUpdate({
        target: siteSettings.id,
        set: {
          siteName: values.siteName,
          supportEmail: values.supportEmail,
          maintenanceMode: values.maintenanceMode,
          allowRegistration: values.allowRegistration,
          currency: values.currency,
          email: values.email as any,
          features: values.features as any,
          updatedAt: new Date(),
        },
      })
    revalidatePath("/ar/admin/settings")
    revalidatePath("/en/admin/settings")
    return { ok: true }
  } catch (e: any) {
    console.error("Error updating site settings:", e)
    return { ok: false, error: e?.message || "Failed to update settings" }
  }
}
