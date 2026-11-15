import nodemailer from "nodemailer"
// @ts-ignore
import { Resend } from "resend"
import { getSiteSettings } from "./db/queries"

const NEON_BLUE = "#0070f3"
const NEON_DARK = "#0f172a"
let mailSettings: Promise<Awaited<ReturnType<typeof getSiteSettings>>> | undefined
let settingsExpireAt = 0

function getMailSettings() {
  if (!mailSettings || Date.now() >= settingsExpireAt) {
    settingsExpireAt = Date.now() + 60_000
    mailSettings = getSiteSettings().catch((error) => {
      mailSettings = undefined
      throw error
    })
  }
  return mailSettings
}

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
  idempotencyKey,
}: {
  to: string
  subject: string
  text?: string
  html?: string
  idempotencyKey?: string
}) {
  try {
    const settings = await getMailSettings()

    // If the HTML is already a full document (e.g. rendered from react-email
    // templates), send it as-is. Otherwise wrap it in the legacy template.
    const isFullDocument = html != null && /<html[\s>]/i.test(html)
    const finalHtml = html ? (isFullDocument ? html : getNeonEmailTemplate(html, settings.siteName)) : undefined

    // 1. Try Resend if API key is available
    const resendKey = process.env.RESEND_API_KEY
    // SMTP has no idempotency contract, so automatic receipt retries require the API.
    if (idempotencyKey && !resendKey) {
      return { success: false, error: "Receipt sending requires Resend API", errorCode: "EMAIL_RECEIPT_PROVIDER_NOT_CONFIGURED" }
    }
    if (resendKey) {
      const resend = new Resend(resendKey)
      const options = { idempotencyKey, signal: AbortSignal.timeout(10_000) }
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM || `"${settings.siteName}" <onboarding@resend.dev>`,
        to: [to],
        subject,
        text: text || "",
        html: finalHtml || "",
      }, options)

      if (error) {
        const domainUnverified = /domain.*not verified/i.test(error.message)
        const rejected = [400, 401, 403, 422, 429].includes(Number((error as { statusCode?: number }).statusCode))
        const errorCode = domainUnverified ? "EMAIL_DOMAIN_UNVERIFIED" : rejected ? "EMAIL_PROVIDER_REJECTED" : "EMAIL_DELIVERY_UNCERTAIN"
        console.error("Resend rejected email", { errorCode, providerError: error.name })
        const smtpHost = (settings.email as any)?.smtpHost || process.env.SMTP_HOST
        // Resend SMTP has the same domain restrictions. Receipt retries must keep API idempotency.
        if (idempotencyKey || String(smtpHost).toLowerCase() === "smtp.resend.com") {
          return { success: false, error: domainUnverified ? "Sending domain is not verified" : "Email provider rejected receipt", errorCode }
        }
      } else {
        if (!data?.id) return { success: false, error: "Email provider returned no message ID", errorCode: "EMAIL_PROVIDER_INVALID_RESPONSE" }
        console.log("Email sent via Resend:", data?.id)
        return { success: true, messageId: data?.id }
      }
    }

    // 2. Fallback to SMTP
    const smtp = settings.email as any
    const host = smtp?.smtpHost || process.env.SMTP_HOST
    const port = Number(smtp?.smtpPort || process.env.SMTP_PORT) || 465
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
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || (String(host).toLowerCase() === "smtp.resend.com" ? process.env.RESEND_FROM : undefined) || `"${settings.siteName}" <${user}>`,
        to,
        subject,
        text,
        html: finalHtml || html, // Use templated or original
      })
      console.log("Message sent via SMTP: %s", info.messageId)
      return { success: true, messageId: info.messageId }
    } finally {
      transporter.close()
    }
  } catch (error: any) {
    console.error("Error sending email", { errorName: error?.name })
    return { success: false, error: "Email delivery could not be confirmed", errorCode: "EMAIL_DELIVERY_UNCERTAIN" }
  }
}
