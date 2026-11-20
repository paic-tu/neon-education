import { test } from "node:test"
import assert from "node:assert/strict"
import Module, { createRequire } from "node:module"
import QRCode from "qrcode"
import sharp from "sharp"
import { ticketCode } from "../lib/event-ticket-code"

test("Full-width rotating white marker preserves QR readability at sampled angles", async () => {
  const require = createRequire(import.meta.url)
  const { QRCodeReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource } = createRequire(require.resolve("@zxing/browser"))("@zxing/library")
  const code = ticketCode({
    id: "9ab24041-5cf8-426d-9669-bbaac28ec692", userId: "buyer",
    orderItemId: "item", productId: "event", ordinal: 1,
  }, "marker-test-secret-with-at-least-32-characters")
  const image = await QRCode.toBuffer(code, { width: 320, margin: 4, errorCorrectionLevel: "H", maskPattern: 3 })
  for (const angle of [-1, ...Array.from({ length: 24 }, (_, i) => i * 15)]) {
    const overlay = Buffer.from(`<svg width="320" height="320"><defs><clipPath id="qr"><polygon points="64,0 256,0 256,64 320,64 320,256 256,256 256,320 64,320 64,256 0,256 0,64 64,64"/></clipPath></defs><g clip-path="url(#qr)"><g transform="rotate(${angle} 160 160)"><path d="M0 160 H320" stroke="white" stroke-width="4"/></g></g></svg>`)
    const { data, info } = await sharp(image).composite(angle < 0 ? [] : [{ input: overlay }]).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true })
    const pixels = new Uint8ClampedArray(info.width * info.height)
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = Math.round((data[i * info.channels] + data[i * info.channels + 1] * 2 + data[i * info.channels + 2]) / 4)
    }
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, info.width, info.height)))
    try { assert.equal(new QRCodeReader().decode(bitmap).getText(), code) }
    catch (error) { throw new Error(`Unreadable marker at ${angle} degrees: ${String(error)}`, { cause: error }) }
  }
})

test("Buyer retains the barcode after admission; revoked tickets have no barcode", async () => {
  const mocks: Record<string, unknown> = {
    "@/lib/auth": { getCurrentUser: async () => ({ id: "buyer" }) },
    "@/lib/events": { getBuyerTickets: async (userId: string) => {
      assert.equal(userId, "buyer")
      return [
        { id: "used", userId, orderItemId: "item", ordinal: 1, ticketNumber: 27, checkedInAt: new Date(), revokedAt: null,
          addOns: [{ id: "dinner", nameAr: "وجبة عشاء", nameEn: "Dinner", price: "25.00" }] },
        { id: "revoked", userId, orderItemId: "item", ordinal: 2, ticketNumber: 28, checkedInAt: null, revokedAt: new Date() },
      ]
    } },
    "@/lib/event-ticket-code": { ticketCode: (ticket: { id: string }) => `code-${ticket.id}` },
    "@/lib/apple-wallet": { appleWalletAvailable: () => false },
  }
  const original = (Module as any)._load
  try {
    ;(Module as any)._load = function (request: string, ...args: unknown[]) {
      return request in mocks ? mocks[request] : original.call(this, request, ...args)
    }
    const { GET } = await import("../app/api/tickets/route")
    const response = await GET(new Request("https://neonedu.org/api/tickets"))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("Cache-Control"), "private, no-store")
    const { tickets } = await response.json()
    assert.equal(tickets[0].code, "code-used")
    assert.equal(tickets[0].ticketNumber, 27)
    assert.equal(tickets[0].addOns[0].nameAr, "وجبة عشاء")
    assert(tickets[0].qr.startsWith("data:image/png;base64,"))
    assert(tickets[0].checkedInAt)
    assert(!("userId" in tickets[0]))
    assert(!("orderItemId" in tickets[0]))
    assert.equal(tickets[1].code, null)
    assert.equal(tickets[1].qr, null)
  } finally { (Module as any)._load = original }
})
