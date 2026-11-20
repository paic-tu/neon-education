import { test } from "node:test"
import assert from "node:assert/strict"
import Module from "node:module"
import { EventError } from "../lib/event-ticket-service"

test("مسار المسح يعرض تفاصيل الدخول السابق فقط للنتيجة المصرح بها", async () => {
  const ticket = {
    id: "02f4e593-d1f7-4060-b5d7-d38b8b95dfc0",
    checkedInAt: "2026-11-21T12:30:00.000Z",
    attendeeName: "Buyer", ticketNumber: 1,
    addOns: [{ id: "dinner", nameAr: "وجبة عشاء", nameEn: "Dinner", price: "30.00", noteAr: "وجبة واحدة" }],
  }
  let failure: EventError | undefined
  let authorized = true, originAllowed = true, calls = 0
  const original = (Module as any)._load
  const mocks = {
    requireSameOrigin: () => { if (!originAllowed) throw new EventError(403, "INVALID_ORIGIN") },
    requireEventUser: async () => {
      if (!authorized) throw new EventError(401, "UNAUTHENTICATED")
      return { id: "staff" }
    },
    EventError,
    checkInTicket: async () => {
      calls++
      if (failure) throw failure
      return ticket
    },
  }
  try {
    ;(Module as any)._load = function (request: string, ...args: unknown[]) {
      return request === "@/lib/events" ? mocks : original.call(this, request, ...args)
    }
    const { POST } = await import("../app/api/events/check-in/route")
    const request = () => new Request("https://neonedu.org/api/events/check-in", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "290a10d8-68da-4235-a1c1-7f224ba03a09", code: "test-code" }),
    })
    const first = await POST(request())
    assert.equal(first.status, 200)
    assert.equal((await first.json()).success, true)

    failure = new EventError(409, "ALREADY_CHECKED_IN", ticket)
    const repeated = await POST(request())
    assert.equal(repeated.status, 409)
    assert.equal(repeated.headers.get("Cache-Control"), "no-store")
    assert.deepEqual(await repeated.json(), { error: "ALREADY_CHECKED_IN", ticket })

    failure = new EventError(403, "FORBIDDEN", ticket)
    const forbidden = await POST(request())
    assert.deepEqual(await forbidden.json(), { error: "FORBIDDEN" })
    failure = new EventError(400, "INVALID_TICKET", ticket)
    assert.deepEqual(await (await POST(request())).json(), { error: "INVALID_TICKET" })
    const callsBefore = calls
    authorized = false
    assert.equal((await POST(request())).status, 401)
    authorized = true
    originAllowed = false
    assert.equal((await POST(request())).status, 403)
    assert.equal(calls, callsBefore)
  } finally {
    ;(Module as any)._load = original
  }
})
