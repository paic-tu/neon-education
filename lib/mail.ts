import nodemailer from "nodemailer"
// @ts-ignore
import { Resend } from "resend"
import { getSiteSettings } from "./db/queries"

const NEON_BLUE = "#0070f3"
const NEON_DARK = "#0f172a"

/**
 * Base template for Neon branded emails
 */
export function getNeonEmailTemplate(content: string, siteName: string) {
  return `
    <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background-color: ${NEON_DARK}; padding: 40px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.025em;">${siteName}</h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px; line-height: 1.6;">
          ${content}
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 14px; color: #64748b; font-weight: 500;">
            © 2026 ${siteName}. جميع الحقوق محفوظة.
          </p>
          <div style="margin-top: 15px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color: ${NEON_BLUE}; text-decoration: none; font-size: 13px; font-weight: 600;">الموقع الرسمي</a>
            <span style="color: #cbd5e1; margin: 0 10px;">|</span>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/support" style="color: ${NEON_BLUE}; text-decoration: none; font-size: 13px; font-weight: 600;">الدعم الفني</a>
          </div>
        </div>
      </div>
    </div>
  `
}

/**
 * Send an email using Resend (priority) or SMTP settings from the database
 */
export async function sendMail({
  to,
  subject,
  text,
  html,
}: {
  to: string
  subject: string
  text?: string
  html?: string
}) {
  try {
    const settings = await getSiteSettings()

    // If the HTML is already a full document (e.g. rendered from react-email
    // templates), send it as-is. Otherwise wrap it in the legacy template.
    const isFullDocument = html != null && /<html[\s>]/i.test(html)
    const finalHtml = html ? (isFullDocument ? html : getNeonEmailTemplate(html, settings.siteName)) : undefined

    // 1. Try Resend if API key is available
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const resend = new Resend(resendKey)
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM || `"${settings.siteName}" <onboarding@resend.dev>`,
        to: [to],
        subject,
        text: text || "",
        html: finalHtml || "",
      })

      if (error) {
        console.error("Resend error:", error)
      } else {
        console.log("Email sent via Resend:", data?.id)
        return { success: true, messageId: data?.id }
      }
    }

    // 2. Fallback to SMTP
    const smtp = settings.email as any
    const host = smtp?.smtpHost || process.env.SMTP_HOST
    const port = smtp?.smtpPort || Number(process.env.SMTP_PORT) || 465
    const user = smtp?.smtpUser || process.env.SMTP_USER
    const pass = smtp?.smtpPassword || process.env.SMTP_PASSWORD

    if (!host || !user || !pass) {
      console.error("Mail settings are not fully configured", { host, user, hasPass: !!pass })
      return { success: false, error: "Mail settings not configured" }
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465 || port === 2465,
      auth: {
        user,
        pass,
      },
    })

    const info = await transporter.sendMail({
      from: `"${settings.siteName}" <${user}>`,
      to,
      subject,
      text,
      html: finalHtml || html, // Use templated or original
    })

    console.log("Message sent via SMTP: %s", info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error: any) {
    console.error("Error sending email:", error)
    return { success: false, error: error.message }
  }
}
