const fs = require("fs")
const path = require("path")
const { Pool } = require("pg")

const envPath = path.join(__dirname, "..", ".env")
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8")
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      let value = match[2] || ""
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      if (!(match[1] in process.env)) process.env[match[1]] = value
    }
  })
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const STEPS = [
  ["Drop existing support_ticket_messages (clean slate)", `DROP TABLE IF EXISTS support_ticket_messages CASCADE`],
  ["Drop existing support_tickets (clean slate)", `DROP TABLE IF EXISTS support_tickets CASCADE`],
  [
    "(Re)create support_tickets table",
    `CREATE TABLE support_tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subject_ar VARCHAR(255) NOT NULL,
      subject_en VARCHAR(255) NOT NULL,
      description_ar TEXT NOT NULL,
      description_en TEXT NOT NULL,
      category support_ticket_category NOT NULL DEFAULT 'technical',
      status support_ticket_status NOT NULL DEFAULT 'open',
      priority VARCHAR(16) NOT NULL DEFAULT 'normal',
      created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
      related_course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
      resolved_at TIMESTAMP,
      closed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
  ],
  [
    "(Re)create support_ticket_messages table",
    `CREATE TABLE support_ticket_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      attachments JSONB DEFAULT '[]'::jsonb,
      is_internal BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
  ],
  ["Index idx_support_tickets_created_by", `CREATE INDEX idx_support_tickets_created_by ON support_tickets(created_by_id)`],
  ["Index idx_support_tickets_assigned_to", `CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to_id)`],
  ["Index idx_support_tickets_status", `CREATE INDEX idx_support_tickets_status ON support_tickets(status)`],
  ["Index idx_support_ticket_messages_ticket", `CREATE INDEX idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id)`],
]

async function run() {
  let client
  const logs = []
  const log = (m) => { logs.push(String(m)); console.log(m) }
  try {
    client = await pool.connect()
    log("[Rebuild] Rebuilding support_tickets + support_ticket_messages...")
    for (let i = 0; i < STEPS.length; i++) {
      const [label, sql] = STEPS[i]
      log(`  → Step ${i + 1}/${STEPS.length}: ${label}`)
      try {
        await client.query(sql)
        log("     ✅ OK")
      } catch (e) {
        log(`     ❌ FAILED: ${e.message}`)
        throw e
      }
    }
    log("[Rebuild] ✅ Support tickets schema rebuilt successfully.")
  } catch (e) {
    log(`[Rebuild] ❌ Overall failure: ${e.message}`)
    process.exitCode = 1
  } finally {
    if (client) client.release()
    await pool.end()
    fs.writeFileSync(path.join(__dirname, "..", "migration-output.txt"), logs.join("\n"), "utf-8")
  }
}
run()
