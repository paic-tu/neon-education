import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requirePermission } from "@/lib/rbac/require-permission"
import { z } from "zod"
import { logAudit, type AuditResource } from "@/lib/audit/audit-logger"
import { sendMail } from "@/lib/mail"
import { getSiteSettings } from "@/lib/db/queries"
import { renderEmailChangedEmail } from "@/lib/emails"

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["student", "instructor", "admin", "manager"]).optional(),
  bio: z.string().optional(),
  points: z.number().optional(),
  level: z.number().optional(),
})

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    await requirePermission("users:read")

    const userId = params.id
    const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (userResult.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { passwordHash, ...user } = userResult[0]
    return NextResponse.json(user)
  } catch (error: any) {
    console.error("[v0] Error fetching user:", error)
    return NextResponse.json({ error: error.message }, { status: error.name === "ForbiddenError" ? 403 : 500 })
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    await requirePermission("users:write")

    const userId = params.id
    const body = await request.json()
    const parseResult = updateUserSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json({ error: "Validation failed", details: parseResult.error.flatten() }, { status: 400 })
    }

    const data = parseResult.data

    // Get before state
    const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const updateData: any = {
      updatedAt: new Date(),
    }
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.email !== undefined) updateData.email = data.email
    if (data.role !== undefined) updateData.role = data.role
    if (data.bio !== undefined) updateData.bio = data.bio
    if (data.points !== undefined) updateData.points = data.points
    if (data.level !== undefined) updateData.level = data.level

    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning()

    if (result.length === 0) {
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
    }

    // Log audit
    await logAudit({
      action: "update",
      resource: "user" as AuditResource,
      resourceId: userId,
      changes: {
        before: existing[0],
        after: result[0],
      },
    })

    // Send Email Changed notification if email was modified
    if (data.email !== undefined && existing[0].email !== data.email) {
      try {
        const settings = await getSiteSettings()
        const { html, text } = await renderEmailChangedEmail({
          language: "ar",
          supportUrl: `${process.env.NEXT_PUBLIC_APP_URL}/ar/support`,
        })
        // Notify old email
        await sendMail({
          to: existing[0].email,
          subject: `تم تغيير بريدك الإلكتروني - ${settings.siteName}`,
          html,
          text,
        })
        // Notify new email
        await sendMail({
          to: data.email,
          subject: `تم تغيير بريدك الإلكتروني - ${settings.siteName}`,
          html,
          text,
        })
      } catch (emailErr) {
        console.error("[v0] Error sending email changed notification:", emailErr)
      }
    }

    const { passwordHash, ...user } = result[0]
    return NextResponse.json(user)
  } catch (error: any) {
    console.error("[v0] Error updating user:", error)
    return NextResponse.json({ error: error.message }, { status: error.name === "ForbiddenError" ? 403 : 500 })
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    await requirePermission("users:delete")

    const userId = params.id

    const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Instead of hard delete, maybe soft delete or deactivate?
    // For now, let's just deactivate them if they have data, or delete if clean.
    // But standard admin delete usually expects real delete or soft delete.
    // Given the schema doesn't have deletedAt, we might want to just set isActive = false?
    // Or actually delete. Let's delete for now, foreign keys should handle cascades or errors.
    // Schema says onDelete: "cascade" for many relations, so it should be fine.
    
    await db.delete(users).where(eq(users.id, userId))

    await logAudit({
      action: "delete",
      resource: "user" as AuditResource,
      resourceId: userId,
      changes: {
        before: existing[0],
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Error deleting user:", error)
    return NextResponse.json({ error: error.message }, { status: error.name === "ForbiddenError" ? 403 : 500 })
  }
}
