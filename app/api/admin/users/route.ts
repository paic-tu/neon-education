import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq, or, and, ilike, desc, getTableColumns } from "drizzle-orm"
import { requirePermission } from "@/lib/rbac/require-permission"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { logAudit, type AuditResource } from "@/lib/audit/audit-logger"
import { requireSameOrigin } from "@/lib/events"

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["student", "instructor", "admin", "manager", "support", "event_staff"]).default("student"),
})

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("users:write")
    requireSameOrigin(request)

    const body = await request.json()
    const parseResult = createUserSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json({ error: "Validation failed", details: parseResult.error.flatten() }, { status: 400 })
    }

    const data = parseResult.data
    if (actor.role !== "admin" && data.role !== "student") {
      return NextResponse.json({ error: "Only admins can assign staff roles" }, { status: 403 })
    }

    // Check if user exists
    const existing = await db.select().from(users).where(eq(users.email, data.email)).limit(1)
    if (existing.length > 0) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    const result = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        passwordHash: hashedPassword,
        role: data.role,
      })
      .returning()

    const user = result[0]

    // Log audit
    await logAudit({
      action: "create",
      resource: "user" as AuditResource,
      resourceId: user.id,
      changes: {
        after: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
    })

    const { passwordHash, ...userWithoutPassword } = user
    return NextResponse.json(userWithoutPassword, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Error creating user:", error)
    return NextResponse.json({ error: error.message }, { status: error.name === "ForbiddenError" ? 403 : 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("users:read")

    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role")
    const search = searchParams.get("search")

    const conditions = []
    
    if (role) {
      conditions.push(eq(users.role, role as any))
    }

    if (search) {
      conditions.push(or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)))
    }

    const result = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt))
      .limit(100)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[v0] Error fetching users:", error)
    return NextResponse.json({ error: error.message }, { status: error.name === "ForbiddenError" ? 403 : 500 })
  }
}
