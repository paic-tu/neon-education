import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, passwordResetTokens } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requirePermission } from "@/lib/rbac/require-permission"
import { z } from "zod"
import { logAudit, type AuditResource } from "@/lib/audit/audit-logger"
import { sendMail } from "@/lib/mail"
import { getSiteSettings } from "@/lib/db/queries"
import { renderResetPasswordEmail, renderPasswordChangedEmail } from "@/lib/emails"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const resetPasswordSchema = z.object({
  mode: z.enum(["link", "direct"]),
  password: z.string().optional(),
  language: z.enum(["ar", "en"]).optional(),
})

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params

  try {
    await requirePermission("users:write")

    const userId = params.id
    const body = await request.json()
    const parsed = resetPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
    }

    const { mode, password, language } = parsed.data

    if (mode === "direct" && (!password || password.length < 8)) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (existing.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const target = existing[0]
    const lang = language === "en" ? "en" : "ar"
    const settings = await getSiteSettings()

    if (mode === "link") {
      const token = crypto.randomBytes(32).toString("hex")
      const expiresAt = new Date(Date.now() + 3600000)

      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, target.email))
      await db.insert(passwordResetTokens).values({ email: target.email, token, expiresAt })

      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://neonedu.org")
        .replace(/^http:\/\//i, "https://")
        .replace(/\/+$/, "")
      const resetUrl = `${baseUrl}/${lang}/auth/reset-password?token=${token}`

      const { html, text } = await renderResetPasswordEmail({
        language: lang,
        resetPasswordUrl: resetUrl,
        userName: target.name ?? undefined,
        expirationMinutes: 60,
      })

      await sendMail({
        to: target.email,
        subject:
          lang === "ar"
            ? `إعادة تعيين كلمة المرور - ${settings.siteName}`
            : `Reset your password - ${settings.siteName}`,
        html,
        text,
      })

      await logAudit({
        action: "update",
        resource: "user" as AuditResource,
        resourceId: userId,
        changes: { passwordResetLinkSent: true, email: target.email },
      })

      return NextResponse.json({ success: true, mode })
    }

    const hashedPassword = await bcrypt.hash(password as string, 10)

    await db
      .update(users)
      .set({ passwordHash: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId))

    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, target.email))

    try {
      const { html, text } = await renderPasswordChangedEmail({
        language: lang,
        userName: target.name ?? undefined,
        supportEmail: settings.supportEmail || "support@neonedu.org",
      })

      await sendMail({
        to: target.email,
        subject:
          lang === "ar"
            ? `تم تغيير كلمة المرور - ${settings.siteName}`
            : `Your password was changed - ${settings.siteName}`,
        html,
        text,
      })
    } catch (emailError) {
      console.error("[v0] Error sending password changed notification:", emailError)
    }

    await logAudit({
      action: "update",
      resource: "user" as AuditResource,
      resourceId: userId,
      changes: { passwordResetByAdmin: true, email: target.email },
    })

    return NextResponse.json({ success: true, mode })
  } catch (error: any) {
    console.error("[v0] Error resetting user password:", error)
    return NextResponse.json(
      { error: error.message },
      { status: error.name === "ForbiddenError" ? 403 : 500 },
    )
  }
}
