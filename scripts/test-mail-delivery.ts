import { test } from "node:test"
import assert from "node:assert/strict"
import Module from "node:module"
import { readFileSync } from "node:fs"

test("Mail coalesces settings reads and bounds sending without duplicate fallback", async (t) => {
  const originalLoad = (Module as any)._load
  const originalFetch = globalThis.fetch
  const keys = ["RESEND_API_KEY", "RESEND_FROM", "SMTP_FROM"] as const
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  let settingsReads = 0, smtpCalls = 0, closed = 0
  let result: "accepted" | "domain-rejected" | "network-error" | "missing-id" = "accepted"
  const message = { to: "buyer@example.test", subject: "Receipt", html: "<html><body>Neon receipt</body></html>", idempotencyKey: "receipt/test" }
  try {
    process.env.RESEND_API_KEY = "test-key"
    process.env.RESEND_FROM = "Neon <no-reply@example.test>"
    delete process.env.SMTP_FROM
    ;(Module as any)._load = function (request: string, ...args: unknown[]) {
      if (request === "./db/queries") return { getSiteSettings: async () => {
        settingsReads++
        await Promise.resolve()
        return { siteName: "Neon", email: { smtpHost: "smtp.resend.com", smtpPort: "465", smtpUser: "resend", smtpPassword: "test-key" } }
      } }
      if (request === "nodemailer") return { createTransport: (options: any) => {
        smtpCalls++
        assert.equal(options.port, 465)
        assert.equal(options.secure, true)
        assert.equal(options.connectionTimeout, 10_000)
        assert.equal(options.greetingTimeout, 10_000)
        assert.equal(options.socketTimeout, 20_000)
        return {
          sendMail: async (payload: any) => {
            assert.equal(payload.from, process.env.RESEND_FROM)
            return { messageId: "smtp-message" }
          },
          close: () => { closed++ },
        }
      } }
      return originalLoad.call(this, request, ...args)
    }
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "https://api.resend.com/emails")
      assert.equal(new Headers(options?.headers).get("Idempotency-Key"), message.idempotencyKey)
      assert(options?.signal instanceof AbortSignal)
      assert.equal(JSON.parse(String(options?.body)).html, message.html)
      if (result === "network-error") throw new TypeError("Network unavailable")
      if (result === "domain-rejected") return new Response(JSON.stringify({
        name: "validation_error", statusCode: 403, message: "The example.test domain is not verified.",
      }), { status: 403 })
      return new Response(JSON.stringify(result === "missing-id" ? {} : { id: "resend-message" }))
    }
    const { sendMail } = await import("../lib/mail")
    await t.test("Concurrent messages share one settings read and retain full templates", async () => {
      const responses = await Promise.all([sendMail(message), sendMail(message)])
      assert(responses.every((response) => response.success))
      assert.equal(settingsReads, 1)
      assert.equal(smtpCalls, 0)
    })
    await t.test("Unverified domains return an actionable error without same-provider fallback", async () => {
      result = "domain-rejected"
      const response = await sendMail(message)
      assert.equal(response.success, false)
      assert.equal(response.errorCode, "EMAIL_DOMAIN_UNVERIFIED")
      assert.equal(smtpCalls, 0)
    })
    await t.test("Uncertain API failures keep receipt idempotency and never switch transports", async () => {
      result = "network-error"
      const response = await sendMail(message)
      assert.equal(response.success, false)
      assert.equal(response.errorCode, "EMAIL_DELIVERY_UNCERTAIN")
      assert.equal(smtpCalls, 0)
    })
    await t.test("A response without a provider message ID is not recorded as sent", async () => {
      result = "missing-id"
      assert.equal((await sendMail(message)).success, false)
    })
    await t.test("Receipts without API configuration never switch to non-idempotent SMTP", async () => {
      delete process.env.RESEND_API_KEY
      const response = await sendMail(message)
      assert.equal(response.errorCode, "EMAIL_RECEIPT_PROVIDER_NOT_CONFIGURED")
      assert.equal(smtpCalls, 0)
    })
    await t.test("SMTP-only non-receipt sends use a valid sender and close bounded connections", async () => {
      const response = await sendMail({ ...message, idempotencyKey: undefined })
      assert.equal(response.success, true)
      assert.equal(smtpCalls, 1)
      assert.equal(closed, 1)
      assert.equal(settingsReads, 1)
    })
  } finally {
    ;(Module as any)._load = originalLoad
    globalThis.fetch = originalFetch
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test("Checkout schedules the receipt after rendering instead of blocking payment confirmation", () => {
  const source = readFileSync(new URL("../app/[lang]/checkout/stream/success/page.tsx", import.meta.url), "utf8")
  assert.match(source, /after\(async \(\) => \{ await notifyPaidOrder\(orderId\) \}\)/)
  assert.doesNotMatch(source, /if \(order && resolvedStatus === "paid"\) await notifyPaidOrder/)
})
