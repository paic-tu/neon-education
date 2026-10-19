import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq, ilike } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { authConfig } from "@/lib/auth.config"
import { sendMail } from "@/lib/mail"
import { getSiteSettings } from "@/lib/db/queries"
import { renderLoginAlertEmail } from "@/lib/emails"

if (!process.env.AUTH_SECRET && process.env.NEXTAUTH_SECRET) {
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET
}

// Fallback for development to prevent crash if secret is missing
if (!process.env.AUTH_SECRET) {
  console.warn("AUTH_SECRET or NEXTAUTH_SECRET is not set. Auth will fail.")
  if (process.env.NODE_ENV !== "production") {
    process.env.AUTH_SECRET = "dev-secret-key-change-me"
  }
}

if (!process.env.AUTH_URL && process.env.NEXTAUTH_URL) {
  process.env.AUTH_URL = process.env.NEXTAUTH_URL
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export interface User {
  id: string
  name: string
  email: string
  role: string
  image?: string | null
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        try {
          console.log("[Auth] Authorize called with:", credentials?.email)
          const validatedFields = loginSchema.safeParse(credentials)

          if (!validatedFields.success) {
            console.log("[Auth] Validation failed:", validatedFields.error)
            return null
          }

          const { email, password } = validatedFields.data

          // Use Drizzle to fetch user
          // Using ilike for case-insensitive email matching
          const user = await db.query.users.findFirst({
            where: ilike(users.email, email),
            columns: {
              id: true,
              email: true,
              name: true,
              role: true,
              avatarUrl: true,
              passwordHash: true,
            }
          })

          if (!user || !user.passwordHash) {
            console.log("[Auth] User not found or no password hash")
            return null
          }

          const passwordsMatch = await bcrypt.compare(password, user.passwordHash)

          if (passwordsMatch) {
            console.log("[Auth] Password match, returning user:", user.id)

            // Send Login Alert Email
            try {
              const settings = await getSiteSettings()
              const { html, text } = await renderLoginAlertEmail({
                language: "ar",
                userName: user.name || "",
                deviceName: "متصفح ويب",
                loginLocation: "السعودية",
                loginTime: new Date().toLocaleString("ar-SA"),
                securityUrl: `${process.env.NEXT_PUBLIC_APP_URL}/ar/portal/settings`,
                supportEmail: settings.supportEmail || "support@neonedu.org",
              })
              await sendMail({
                to: user.email,
                subject: `تنبيه: تسجيل دخول جديد - ${settings.siteName}`,
                html,
                text,
              })
            } catch (emailErr) {
              console.error("[Auth] Error sending login alert email:", emailErr)
            }

            return {
              id: user.id,
              email: user.email,
              name: user.name || "",
              role: user.role || "student",
              image: user.avatarUrl || null,
            }
          }

          console.log("[Auth] Password mismatch")
          return null
        } catch (error) {
          console.error("[Auth] Authorize error:", error)
          // Throw the error to let the client know it's a system error, not invalid credentials
          throw error
        }
      },
    }),
  ],
})

export const getCurrentUser = async () => {
  const session = await auth()
  if (!session?.user?.id) return null
  
  // Optimization: Trust session data for fast access
  // Uncomment the DB fetch if you need real-time role/profile updates that bypass session duration
  /*
  try {
    const fresh = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
      },
    })
    if (fresh) {
      return {
        ...session.user,
        role: fresh.role || session.user.role,
        name: fresh.name ?? session.user.name,
        email: fresh.email ?? session.user.email,
        image: fresh.avatarUrl ?? session.user.image,
      }
    }
  } catch (e: any) {
    console.warn("[Auth] Failed to fetch fresh user from DB, falling back to session. Error:", e.message || e)
  }
  */
  
  return session.user
}

export const currentRole = async () => {
  const session = await auth()
  return session?.user?.role
}
