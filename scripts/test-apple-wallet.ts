import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { createHash } from "node:crypto"
import { appleWalletAvailable, createAppleWalletPass, walletPassDetails, walletTicketUsable, type WalletTicket } from "../lib/apple-wallet"
import { ticketCode } from "../lib/event-ticket-code"

const ticket: WalletTicket = {
  id: "9ab24041-5cf8-426d-9669-bbaac28ec692", userId: "buyer", orderItemId: "item", productId: "event", ordinal: 1,
  ticketNumber: 27,
  nameAr: "فعالية نيون", nameEn: "Neon event", eventLocation: "Riyadh",
  eventStartsAt: new Date(Date.now() + 3600000), eventEndsAt: new Date(Date.now() + 7200000),
  checkedInAt: null, revokedAt: null, orderId: "order",
}

test("Wallet refuses invalid, revoked, admitted and expired tickets", async () => {
  assert(walletTicketUsable(ticket))
  assert(!walletTicketUsable({ ...ticket, revokedAt: new Date() }))
  assert(!walletTicketUsable({ ...ticket, checkedInAt: new Date() }))
  assert(!walletTicketUsable({ ...ticket, eventEndsAt: new Date(0) }))
  assert(!walletTicketUsable({ ...ticket, eventEndsAt: null }))
  assert(!walletTicketUsable({ ...ticket, eventEndsAt: "invalid" }))
  await assert.rejects(createAppleWalletPass({ ...ticket, checkedInAt: new Date() }, "ar"), /TICKET_UNAVAILABLE/)
  assert.equal(walletPassDetails(ticket, "ar").sharingProhibited, true)
  assert.equal(walletPassDetails(ticket, "en").serialNumber, ticket.id)
})

test("Wallet creates a signed Neon archive with the existing admission barcode", async () => {
  // Test certificates only; these are not trusted by Apple or used in production.
  const require = createRequire(import.meta.url)
  const forge = createRequire(require.resolve("passkit-generator"))("node-forge")
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = "01"
  cert.validity.notBefore = new Date(Date.now() - 60000)
  cert.validity.notAfter = new Date(Date.now() + 86400000)
  const subject = [
    { name: "commonName", value: "Wallet test only" },
    { shortName: "OU", value: "TESTTEAM01" },
    { type: "0.9.2342.19200300.100.1.1", value: "pass.test.neon" },
  ]
  cert.setSubject(subject)
  cert.setIssuer(subject)
  cert.sign(keys.privateKey, forge.md.sha256.create())
  const values: Record<string, string> = {
    APPLE_WALLET_PASS_TYPE_ID: "pass.test.neon", APPLE_WALLET_TEAM_ID: "TESTTEAM01",
    APPLE_WALLET_SIGNER_CERT_BASE64: Buffer.from(forge.pki.certificateToPem(cert)).toString("base64"),
    APPLE_WALLET_SIGNER_KEY_BASE64: Buffer.from(forge.pki.privateKeyToPem(keys.privateKey)).toString("base64"),
    APPLE_WALLET_WWDR_CERT_BASE64: Buffer.from(forge.pki.certificateToPem(cert)).toString("base64"),
    EVENT_TICKET_SECRET: "wallet-test-secret-with-at-least-32-characters",
  }
  const previous = Object.fromEntries([...Object.keys(values), "APPLE_WALLET_SIGNER_KEY_PASSPHRASE"].map((key) => [key, process.env[key]]))
  try {
    delete process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE
    Object.assign(process.env, values)
    assert(appleWalletAvailable())
    const archive = await createAppleWalletPass(ticket, "ar")
    const files: Record<string, Buffer> = {}
    let offset = 0
    while (archive.readUInt32LE(offset) === 0x04034b50) {
      assert.equal(archive.readUInt16LE(offset + 8), 0)
      const size = archive.readUInt32LE(offset + 18)
      const nameSize = archive.readUInt16LE(offset + 26)
      const extraSize = archive.readUInt16LE(offset + 28)
      const name = archive.subarray(offset + 30, offset + 30 + nameSize).toString()
      const start = offset + 30 + nameSize + extraSize
      files[name] = archive.subarray(start, start + size)
      offset = start + size
    }
    assert(files.signature.length > 0)
    assert(files["icon.png"].length > 0)
    const manifest = JSON.parse(files["manifest.json"].toString())
    for (const [name, hash] of Object.entries(manifest)) assert.equal(createHash("sha1").update(files[name]).digest("hex"), hash)
    const payload = JSON.parse(files["pass.json"].toString())
    assert.equal(payload.barcodes[0].message, ticketCode(ticket))
    assert.equal(payload.serialNumber, ticket.id)
    assert.equal(payload.passTypeIdentifier, "pass.test.neon")
    assert.equal(payload.eventTicket.primaryFields[0].value, ticket.nameAr)
    assert.equal(payload.eventTicket.headerFields[0].value, "#27")
    assert.equal(payload.sharingProhibited, true)
    process.env.APPLE_WALLET_TEAM_ID = "WRONGTEAM"
    assert(!appleWalletAvailable())
    delete process.env.APPLE_WALLET_SIGNER_CERT_BASE64
    assert(!appleWalletAvailable())
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
