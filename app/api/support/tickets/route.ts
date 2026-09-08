import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { supportTickets, courses } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac/permissions"
import { z } from "zod"
import { listSupportTickets } from "@/lib/db/support-queries"

const createTicketSchema = z.object({
  subjectAr: z.string().min(3).max(255),
  subjectEn: z.string().min(3).max(255),
  descriptionAr: z.string().min(10),
  descriptionEn: z.string().min(10),
  category: z.enum(["technical", "billing", "course_content", "account", "other"]),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  relatedCourseId: z.string().uuid().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role || "student"
    const userId = session.user.id

    const { searchParams } = new URL(request.url)
    const filters = {
      status: searchParams.get("status"),
      category: searchParams.get("category"),
      priority: searchParams.get("priority"),
      assignedToId: searchParams.get("assignedToId"),
      createdById: searchParams.get("createdById"),
      relatedCourseId: searchParams.get("relatedCourseId"),
      search: searchParams.get("search"),
    }

    const tickets = await listSupportTickets(userId, userRole, filters)

    return NextResponse.json({ tickets })
  } catch (error) {
    console.error("[SUPPORT_TICKETS_GET]", error)
    return NextResponse.json({ tickets: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role || "student"
    const allowedRoles = ["student", "instructor", "admin", "manager", "support"]
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parseResult = createTicketSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = parseResult.data

    if (data.relatedCourseId) {
      const courseExists = await db.query.courses.findFirst({
        where: eq(courses.id, data.relatedCourseId),
        columns: { id: true },
      })
      if (!courseExists) {
        return NextResponse.json({ error: "Related course not found" }, { status: 404 })
      }
    }

    const [ticket] = await db
      .insert(supportTickets)
      .values({
        subjectAr: data.subjectAr,
        subjectEn: data.subjectEn,
        descriptionAr: data.descriptionAr,
        descriptionEn: data.descriptionEn,
        category: data.category,
        priority: data.priority,
        createdById: session.user.id,
        relatedCourseId: data.relatedCourseId || null,
      })
      .returning()

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    console.error("[SUPPORT_TICKETS_POST]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
