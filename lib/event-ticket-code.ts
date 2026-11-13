import { createHmac, timingSafeEqual } from "node:crypto"

export interface TicketIdentity {
  id: string
  orderItemId: string
  productId: string
  userId: string
  ordinal: number
}

export function getTicketSigningKey() {
  const secret = process.env.EVENT_TICKET_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret || secret.length < 32 || secret === "dev-secret-key-change-me") {
    throw new Error("Event ticket signing key is not configured")
  }
  return secret
}

export function ticketCode(ticket: TicketIdentity, key = getTicketSigningKey()) {
  const context = JSON.stringify(["neon-event-ticket-v1", ticket.id, ticket.orderItemId, ticket.productId, ticket.userId, ticket.ordinal])
  const signature = createHmac("sha256", key).update(context).digest("hex")
  return `NEVT1.${ticket.id}.${signature}`
}

export function parseTicketCode(code: string) {
  const match = /^NEVT1\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9a-f]{64})$/.exec(code)
  return match ? { id: match[1] } : null
}

export function verifyTicketCode(code: string, ticket: TicketIdentity, key = getTicketSigningKey()) {
  if (!parseTicketCode(code)) return false
  const actual = Buffer.from(code)
  const expected = Buffer.from(ticketCode(ticket, key))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
