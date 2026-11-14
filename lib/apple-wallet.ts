import { readFile } from "node:fs/promises"
import path from "node:path"
import { createPrivateKey, X509Certificate } from "node:crypto"
import { PKPass } from "passkit-generator"
import sharp from "sharp"
import { ticketCode, type TicketIdentity } from "@/lib/event-ticket-code"

export interface WalletTicket extends TicketIdentity {
  nameAr: string | null
  nameEn: string | null
  eventStartsAt: Date | string | null
  eventEndsAt: Date | string | null
  eventLocation: string | null
  checkedInAt: Date | string | null
  revokedAt: Date | string | null
  orderId: string
}

function configuration() {
  const env = process.env
  const passTypeIdentifier = env.APPLE_WALLET_PASS_TYPE_ID
  const teamIdentifier = env.APPLE_WALLET_TEAM_ID
  if (!passTypeIdentifier?.startsWith("pass.") || !teamIdentifier
    || !env.APPLE_WALLET_SIGNER_CERT_BASE64 || !env.APPLE_WALLET_SIGNER_KEY_BASE64
    || !env.APPLE_WALLET_WWDR_CERT_BASE64) throw new Error("WALLET_NOT_CONFIGURED")
  const signerCert = Buffer.from(env.APPLE_WALLET_SIGNER_CERT_BASE64, "base64")
  const signerKey = Buffer.from(env.APPLE_WALLET_SIGNER_KEY_BASE64, "base64")
  const wwdr = Buffer.from(env.APPLE_WALLET_WWDR_CERT_BASE64, "base64")
  const certificate = new X509Certificate(signerCert)
  const issuer = new X509Certificate(wwdr)
  const key = createPrivateKey({ key: signerKey, passphrase: env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE })
  const subject = certificate.subject.split("\n")
  if (!subject.includes(`UID=${passTypeIdentifier}`) || !subject.includes(`OU=${teamIdentifier}`)
    || Date.parse(certificate.validFrom) > Date.now() || Date.parse(certificate.validTo) <= Date.now()
    || Date.parse(issuer.validFrom) > Date.now() || Date.parse(issuer.validTo) <= Date.now()
    || !certificate.checkPrivateKey(key) || !certificate.verify(issuer.publicKey)) {
    throw new Error("WALLET_INVALID_CERTIFICATE")
  }
  return {
    passTypeIdentifier, teamIdentifier,
    certificates: {
      signerCert,
      signerKey,
      wwdr,
      signerKeyPassphrase: env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE,
    },
  }
}

export function appleWalletAvailable() {
  try { configuration(); return true } catch { return false }
}

export function walletTicketUsable(ticket: WalletTicket, now = Date.now()) {
  return !ticket.revokedAt && !ticket.checkedInAt && Boolean(ticket.eventEndsAt)
    && new Date(ticket.eventEndsAt!).getTime() > now
}

export function walletPassDetails(ticket: WalletTicket, lang: string) {
  const ar = lang === "ar"
  return {
    description: ar ? `تذكرة نيون - ${ticket.nameAr || ticket.nameEn}` : `Neon ticket - ${ticket.nameEn || ticket.nameAr}`,
    organizationName: "Neon",
    serialNumber: ticket.id,
    logoText: ar ? "نيون | الفعاليات" : "NEON | EVENTS",
    backgroundColor: "rgb(23, 19, 43)",
    foregroundColor: "rgb(255, 255, 255)",
    labelColor: "rgb(206, 189, 255)",
    sharingProhibited: true,
  }
}

let brandAssets: Promise<Record<string, Buffer>> | undefined
function assets() {
  // Only local brand assets are packaged; ticket codes never leave the server.
  brandAssets ??= readFile(path.join(process.cwd(), "public/icons/icon-512.png")).then(async (source) => {
    const entries = await Promise.all([1, 2, 3].map(async (scale) =>
      [scale === 1 ? "icon.png" : `icon@${scale}x.png`, await sharp(source).resize(29 * scale, 29 * scale).png().toBuffer()] as const))
    return Object.fromEntries(entries)
  }).catch((error) => { brandAssets = undefined; throw error })
  return brandAssets
}

export async function createAppleWalletPass(ticket: WalletTicket, lang: string) {
  if (!walletTicketUsable(ticket)) throw new Error("TICKET_UNAVAILABLE")
  const { certificates, passTypeIdentifier, teamIdentifier } = configuration()
  const ar = lang === "ar"
  const pass = new PKPass(await assets(), certificates, {
    ...walletPassDetails(ticket, lang), passTypeIdentifier, teamIdentifier,
  })
  pass.type = "eventTicket"
  pass.primaryFields.push({ key: "event", label: ar ? "الفعالية" : "EVENT", value: (ar ? ticket.nameAr : ticket.nameEn) || ticket.nameEn || ticket.nameAr || "Neon" })
  pass.secondaryFields.push({ key: "location", label: ar ? "الموقع" : "VENUE", value: ticket.eventLocation || "Neon" })
  if (ticket.eventStartsAt) {
    pass.auxiliaryFields.push({ key: "date", label: ar ? "التاريخ" : "DATE", value: new Date(ticket.eventStartsAt).toISOString(), dateStyle: "PKDateStyleMedium", timeStyle: "PKDateStyleShort" })
    pass.setRelevantDate(new Date(ticket.eventStartsAt))
  }
  pass.headerFields.push({ key: "number", label: ar ? "التذكرة" : "TICKET", value: `#${ticket.ordinal}` })
  pass.backFields.push(
    { key: "privacy", label: ar ? "تعليمات الدخول" : "ADMISSION", value: ar ? "لا تشارك الباركود. التذكرة لشخص واحد ودخول واحد فقط. التذاكر الملغاة أو المستخدمة لا تسمح بالدخول." : "Keep your barcode private. One person, one admission. Revoked or used tickets cannot admit entry." },
    { key: "order", label: ar ? "الطلب" : "ORDER", value: ticket.orderId },
  )
  pass.setExpirationDate(new Date(ticket.eventEndsAt!))
  pass.setBarcodes({ format: "PKBarcodeFormatQR", message: ticketCode(ticket), messageEncoding: "iso-8859-1" })
  return pass.getAsBuffer()
}
