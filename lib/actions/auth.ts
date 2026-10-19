"use server"

import { signIn } from "@/lib/auth"
import { AuthError } from "next-auth"
import { db } from "@/lib/db"
import { users, passwordResetTokens } from "@/lib/db/schema"
import { eq, ilike } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { sendMail } from "@/lib/mail"
import { getSiteSettings } from "@/lib/db/queries"
import {
  renderResetPasswordEmail,
  renderPasswordChangedEmail,
  renderWelcomeEmail,
  renderVerifyEmail,
  renderVerificationCodeEmail,
  renderAccountCreatedEmail,
} from "@/lib/emails"
import crypto from "crypto"

export async function forgotPasswordAction(formData: FormData) {
  try {
    const email = (formData.get("email") as string)?.toLowerCase()

    if (!email) {
      return { error: "Email is required" }
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (!user) {
      // Don't reveal if user exists for security
      return { success: true }
    }

    // Generate token
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 3600000) // 1 hour

    // Delete any existing tokens for this email
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, email))

    // Save token
    await db.insert(passwordResetTokens).values({
      email,
      token,
      expiresAt,
    })

    // Send Reset Email
    const settings = await getSiteSettings()
    const lang = (formData.get("lang") as string) || "ar"
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${lang}/auth/reset-password?token=${token}`

    const { html, text } = await renderResetPasswordEmail({
      language: lang === "ar" ? "ar" : "en",
      resetPasswordUrl: resetUrl,
      userName: user.name,
      expirationMinutes: 60,
    })

    await sendMail({
      to: email,
      subject: lang === "ar"
        ? `إعادة تعيين كلمة المرور - ${settings.siteName}`
        : `Reset your password - ${settings.siteName}`,
      html,
      text,
    })

    return { success: true }
  } catch (error) {
    console.error("Forgot password error:", error)
    return { error: "Failed to send reset email" }
  }
}

export async function resetPasswordAction(formData: FormData) {
  try {
    const token = formData.get("token") as string
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string

    if (!token || !password || !confirmPassword) {
      return { error: "All fields are required" }
    }

    if (password !== confirmPassword) {
      return { error: "Passwords do not match" }
    }

    if (password.length < 6) {
      return { error: "Password must be at least 6 characters" }
    }

    // Verify token
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.token, token),
    })

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return { error: "Invalid or expired token" }
    }

    // Update user password
    const hashedPassword = await bcrypt.hash(password, 10)
    await db.update(users)
      .set({ passwordHash: hashedPassword, updatedAt: new Date() })
      .where(eq(users.email, resetToken.email))

    // Send Confirmation Email
    try {
      const settings = await getSiteSettings()
      const { html, text } = await renderPasswordChangedEmail({
        language: "ar",
        supportEmail: settings.supportEmail || "support@neonedu.org",
      })
      await sendMail({
        to: resetToken.email,
        subject: `تم تغيير كلمة المرور بنجاح - ${settings.siteName}`,
        html,
        text,
      })
    } catch (error) {
      console.error("Error sending password reset confirmation email:", error)
    }

    // Delete the token
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token))

    return { success: true }
  } catch (error) {
    console.error("Reset password error:", error)
    return { error: "Failed to reset password" }
  }
}

export async function loginAction(prevState: any, formData: FormData) {
  try {
    const email = (formData.get("email") as string)?.toLowerCase()
    const password = formData.get("password") as string
    const redirectTo = formData.get("redirectTo") as string | undefined

    if (!email || !password) {
      return { error: "Email and password are required" }
    }

    await signIn("credentials", {
      email,
      password,
      redirectTo: redirectTo || "/",
    })
    
    return { success: true }
  } catch (error: any) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid credentials." }
        default:
          return { error: "Something went wrong." }
      }
    }

    // Check for redirect error
    if (error.digest?.startsWith("NEXT_REDIRECT") || error.message === "NEXT_REDIRECT") {
      return { success: true }
    }

    throw error
  }
}

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phoneNumber: z.string().min(1, "Phone number is required"),
})

export async function registerAction(formData: FormData) {
  try {
    const name = formData.get("name") as string
    const email = (formData.get("email") as string)?.toLowerCase()
    const password = formData.get("password") as string
    const phoneNumber = formData.get("phoneNumber") as string

    if (!name || !email || !password || !phoneNumber) {
      return { error: "Missing required fields" }
    }

    const validatedFields = registerSchema.safeParse({ name, email, password, phoneNumber })

    if (!validatedFields.success) {
      return { error: validatedFields.error.errors[0].message }
    }

    const existingUser = await db.query.users.findFirst({
      where: ilike(users.email, email),
    })

    if (existingUser) {
      return { error: "Email already registered" }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await db.insert(users).values({
      name,
      email,
      passwordHash: hashedPassword,
      role: "student",
      phoneNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Send Welcome Email
    try {
      const settings = await getSiteSettings()
      const { html, text } = await renderWelcomeEmail({
        language: "ar",
        userName: name,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/ar/auth/login`,
      })
      await sendMail({
        to: email,
        subject: `مرحباً بك في ${settings.siteName}!`,
        html,
        text,
      })

      // Send Account Created Email
      const accountData = await renderAccountCreatedEmail({
        language: "ar",
        userName: name,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/ar/portal/dashboard`,
      })
      await sendMail({
        to: email,
        subject: `تم إنشاء حسابك بنجاح - ${settings.siteName}`,
        html: accountData.html,
        text: accountData.text,
      })

      // Send Email Verification Email
      const verificationCode = crypto.randomInt(100000, 999999).toString()
      const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/ar/auth/verify?email=${encodeURIComponent(email)}`

      const verifyData = await renderVerifyEmail({
        language: "ar",
        verificationUrl: verifyUrl,
        userName: name,
        expirationMinutes: 30,
      })
      await sendMail({
        to: email,
        subject: `أكّد بريدك الإلكتروني - ${settings.siteName}`,
        html: verifyData.html,
        text: verifyData.text,
      })

      // Send Verification Code Email (OTP)
      const codeData = await renderVerificationCodeEmail({
        language: "ar",
        verificationCode,
        userName: name,
        expirationMinutes: 10,
      })
      await sendMail({
        to: email,
        subject: `رمز التحقق الخاص بك - ${settings.siteName}`,
        html: codeData.html,
        text: codeData.text,
      })
    } catch (error) {
      console.error("Error sending registration emails:", error)
    }

    return { success: true }
  } catch (error) {
    console.error("Registration error:", error)
    return { error: "Registration failed" }
  }
}
