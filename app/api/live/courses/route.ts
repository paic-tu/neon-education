import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { courses, enrollments } from "@/lib/db/schema"
import { and, eq, desc } from "drizzle-orm"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = (session.user as any).role || "student"
  let rows: Array<{ id: string; titleEn: string; titleAr: string; isLive: boolean }> = []

  if (role === "student") {
    const result = await db
      .select({
        id: courses.id,
        titleEn: courses.titleEn,
        titleAr: courses.titleAr,
        isLive: courses.isLive,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(and(eq(enrollments.userId, session.user.id), eq(courses.isStreaming, true)))
      .orderBy(desc(courses.updatedAt))
    rows = result
  } else if (role === "instructor") {
    const result = await db.query.courses.findMany({
      where: and(eq(courses.instructorId, session.user.id), eq(courses.isStreaming, true)),
      orderBy: [desc(courses.updatedAt)],
      columns: { id: true, titleEn: true, titleAr: true, isLive: true },
    })
    rows = result
  } else if (role === "admin") {
    // Admins see every live-enabled course so they can step into a session
    // at any time, not only while a broadcast is already running.
    const result = await db.query.courses.findMany({
      where: eq(courses.isLive, true),
      orderBy: [desc(courses.updatedAt)],
      columns: { id: true, titleEn: true, titleAr: true, isLive: true },
    })
    rows = result
  }

  return NextResponse.json({ courses: rows })
}
