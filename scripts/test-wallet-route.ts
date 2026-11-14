import { test } from "node:test"
import assert from "node:assert/strict"
import Module from "node:module"

test("Wallet download requires the buyer's paid, active, usable ticket", async () => {
  let user: { id: string } | null = { id: "buyer" }
  let found = true, usable = true, configured = true
  let generated = 0
  const id = "9ab24041-5cf8-426d-9669-bbaac28ec692"
  const mocks: Record<string, unknown> = {
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/events": { getBuyerTickets: async (userId: string, cursor: unknown, order: unknown, ticketId: string) => {
      assert.equal(userId, "buyer")
      assert.equal(cursor, undefined)
      assert.equal(order, undefined)
      assert.equal(ticketId, id)
      return found ? [{ id }] : []
    } },
    "@/lib/apple-wallet": {
      appleWalletAvailable: () => configured, walletTicketUsable: () => usable,
      createAppleWalletPass: async () => { generated++; return Buffer.from("signed-pass") },
    },
  }
  const original = (Module as any)._load
  try {
    ;(Module as any)._load = function (request: string, ...args: unknown[]) {
      return request in mocks ? mocks[request] : original.call(this, request, ...args)
    }
    const { GET } = await import("../app/api/tickets/[ticketId]/wallet/route")
    const run = (ticketId = id) => GET(new Request(`https://neonedu.org/api/tickets/${ticketId}/wallet?lang=ar`), { params: Promise.resolve({ ticketId }) })
    user = null
    assert.equal((await run()).status, 401)
    user = { id: "buyer" }
    assert.equal((await run("invalid")).status, 400)
    found = false
    assert.equal((await run()).status, 404)
    found = true
    usable = false
    assert.equal((await run()).status, 409)
    usable = true
    configured = false
    assert.equal((await run()).status, 503)
    assert.equal(generated, 0)
    configured = true
    const response = await run()
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("Content-Type"), "application/vnd.apple.pkpass")
    assert.equal(response.headers.get("Cache-Control"), "private, no-store")
    assert.equal(await response.text(), "signed-pass")
    assert.equal(generated, 1)
  } finally { (Module as any)._load = original }
})
