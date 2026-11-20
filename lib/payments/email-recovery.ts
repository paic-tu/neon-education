import { createHash, randomUUID, timingSafeEqual } from "node:crypto"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { sendMail } from "@/lib/mail"
import { retryPendingPaymentReceipts, type Connection, type MailSender } from "./payment-notifications"

const rows = (result: any): any[] => Array.isArray(result) ? result : result.rows || []
const terminalEvents = ["delivered", "bounced", "complained", "suppressed", "failed"]

export function isEmailRecoveryAuthorized(authorization: string | null, secret = process.env.CRON_SECRET) {
  if (!secret || secret.length < 32 || !authorization?.startsWith("Bearer ")) return false
  const digest = (value: string) => createHash("sha256").update(value).digest()
  return timingSafeEqual(digest(authorization.slice(7)), digest(secret))
}

async function providerGet(path: string, request: typeof fetch) {
  const response = await request(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  })
  if (response.status === 404 && path.startsWith("/emails/")) return { last_event: "unknown" }
  if (!response.ok) throw new Error("EMAIL_MONITOR_PROVIDER_ERROR")
  return response.json()
}

export async function checkSendingDomain(request: typeof fetch = fetch) {
  if (!process.env.RESEND_API_KEY) throw new Error("EMAIL_MONITOR_NOT_CONFIGURED")
  const domain = process.env.RESEND_FROM?.match(/@([^>\s]+)/)?.[1]?.toLowerCase()
  if (!domain) throw new Error("EMAIL_SENDER_NOT_CONFIGURED")
  const list = await providerGet("/domains", request)
  const configured = list.data?.find((item: { name: string }) => item.name.toLowerCase() === domain)
  if (!configured) throw new Error("EMAIL_DOMAIN_NOT_FOUND")
  const detail = await providerGet(`/domains/${encodeURIComponent(configured.id)}`, request)
  return detail.status === "verified" ? "verified" : "unverified"
}

export async function runEmailRecovery(connection: Connection = db, send: MailSender = sendMail, request: typeof fetch = fetch, minimumRequestInterval = 600) {
  const claimId = randomUUID()
  const deadline = Date.now() + 40_000
  const claim = rows(await connection.execute(sql`
    INSERT INTO payment_email_health (id, claim_id, claimed_at) VALUES ('global', ${claimId}::uuid, NOW())
    ON CONFLICT (id) DO UPDATE SET claim_id = EXCLUDED.claim_id, claimed_at = NOW()
    WHERE payment_email_health.claimed_at IS NULL OR payment_email_health.claimed_at < NOW() - INTERVAL '2 minutes'
    RETURNING id
  `))
  if (!claim.length) return { skipped: true as const, accepted: 0, failed: 0, checked: 0 }
  let domainStatus = "unknown", lastError: string | null = null
  let nextRequestAt = 0
  // Resend's default limit is two requests per second, including monitoring calls.
  const providerSlot = async () => {
    const delay = Math.max(0, nextRequestAt - Date.now())
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    nextRequestAt = Date.now() + minimumRequestInterval
  }
  const pacedRequest: typeof fetch = async (...args) => { await providerSlot(); return request(...args) }
  const pacedSend: MailSender = async (message) => { await providerSlot(); return send(message) }
  try {
    domainStatus = await checkSendingDomain(pacedRequest)
    const outcome = domainStatus === "verified"
      ? await retryPendingPaymentReceipts(connection, pacedSend, deadline)
      : { accepted: 0, failed: 0 }
    if (domainStatus !== "verified") lastError = "EMAIL_DOMAIN_UNVERIFIED"
    else if (outcome.failed > 0) lastError = "EMAIL_RECEIPT_RETRY_FAILED"

    const sent = rows(await connection.execute(sql`
      SELECT order_id, message_id, message_type FROM order_email_queue
      WHERE sent_at IS NOT NULL AND message_id IS NOT NULL
        AND COALESCE(last_event, '') NOT IN ('delivered', 'bounced', 'complained', 'suppressed', 'failed', 'unknown')
        AND (delivery_checked_at IS NULL OR delivery_checked_at < NOW() - INTERVAL '5 minutes')
      ORDER BY delivery_checked_at ASC NULLS FIRST, sent_at ASC LIMIT 5
    `))
    let checked = 0
    for (const receipt of sent) {
      if (Date.now() >= deadline) break
      // Old SMTP IDs cannot be looked up through the Resend API.
      const validId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(receipt.message_id)
      let event = "unknown"
      if (validId) {
        const email = await providerGet(`/emails/${encodeURIComponent(receipt.message_id)}`, pacedRequest)
        event = ["queued", "sent", "delivery_delayed", ...terminalEvents].includes(email.last_event) ? email.last_event : "unknown"
      }
      const table = sql.raw(receipt.message_type === "tickets" ? "ticket_email_notifications" : "payment_email_notifications")
      await connection.execute(sql`
        UPDATE ${table} SET last_event = ${event}, delivery_checked_at = NOW()
        WHERE order_id = ${receipt.order_id}::uuid AND message_id = ${receipt.message_id}
      `)
      checked++
    }
    return { skipped: false as const, domainStatus, ...outcome, checked }
  } catch {
    lastError = "EMAIL_RECOVERY_FAILED"
    throw new Error(lastError)
  } finally {
    await connection.execute(sql`
      UPDATE payment_email_health SET last_run_at = NOW(), domain_status = ${domainStatus},
        last_error = ${lastError}, claim_id = NULL, claimed_at = NULL
      WHERE id = 'global' AND claim_id = ${claimId}::uuid
    `)
  }
}

export async function getEmailRecoveryHealth(connection: Connection = db) {
  const [health] = rows(await connection.execute(sql`
    SELECT last_run_at, domain_status, last_error,
      last_run_at IS NULL OR last_run_at < NOW() - INTERVAL '15 minutes' AS stale
    FROM payment_email_health WHERE id = 'global'
  `))
  const [counts] = rows(await connection.execute(sql`
    SELECT
      count(*) FILTER (WHERE n.sent_at IS NULL AND o.paid_at < NOW() - INTERVAL '2 minutes')::int AS pending,
      count(*) FILTER (WHERE n.sent_at IS NULL AND n.first_attempt_at < NOW() - INTERVAL '23 hours')::int AS review,
      count(*) FILTER (WHERE n.last_event IN ('bounced', 'complained', 'suppressed', 'failed', 'unknown')
        OR (n.sent_at < NOW() - INTERVAL '15 minutes' AND COALESCE(n.last_event, '') NOT IN ('delivered', 'bounced', 'complained', 'suppressed', 'failed', 'unknown')))::int AS delivery_issues
    FROM order_email_queue n JOIN orders o ON o.id = n.id
    WHERE o.status = 'paid' AND o.paid_at IS NOT NULL
  `))
  return {
    stale: !health || Boolean(health.stale),
    domainStatus: health?.domain_status || "unknown",
    monitorError: health?.last_error || null,
    pending: counts?.pending || 0,
    review: counts?.review || 0,
    deliveryIssues: counts?.delivery_issues || 0,
  }
}
