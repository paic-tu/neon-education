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

const logLines = []
function log(msg) {
  logLines.push(String(msg))
  console.log(msg)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  idleTimeoutMillis: 30000,
})

const STEPS = [
  [
    "Add is_approved column",
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false`,
  ],
  [
    "Add approved_at column",
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`,
  ],
  [
    "Add approved_by column (FK users)",
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL`,
  ],
  [
    "Add approval_note column",
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS approval_note TEXT`,
  ],
  [
    "Add deletion_requested column",
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS deletion_requested BOOLEAN NOT NULL DEFAULT false`,
  ],
  [
    "Add deletion_requested_at column",
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP`,
  ],
  [
    "Add deletion_requested_reason column",
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS deletion_requested_reason TEXT`,
  ],
  [
    "Add deletion_reviewed_by column (FK users)",
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS deletion_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL`,
  ],
  [
    "Add deletion_reviewed_at column",
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS deletion_reviewed_at TIMESTAMP`,
  ],
  [
    "Add deletion_rejected_reason column",
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS deletion_rejected_reason TEXT`,
  ],
  [
    "Backfill existing published courses as approved",
    `UPDATE courses SET is_approved = true WHERE is_approved = false AND is_published = true`,
  ],
  [
    "Create support_ticket_status enum",
    `DO $$ BEGIN CREATE TYPE support_ticket_status AS ENUM ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ],
  [
    "Create support_ticket_category enum",
    `DO $$ BEGIN CREATE TYPE support_ticket_category AS ENUM ('technical', 'billing', 'course_content', 'account', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ],
  [
    "Create support_tickets table",
    `CREATE TABLE IF NOT EXISTS support_tickets (
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
    "Create support_ticket_messages table",
    `CREATE TABLE IF NOT EXISTS support_ticket_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      attachments JSONB DEFAULT '[]'::jsonb,
      is_internal BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
  ],
  [
    "Index: idx_support_tickets_created_by",
    `CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON support_tickets(created_by_id)`,
  ],
  [
    "Index: idx_support_tickets_assigned_to",
    `CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to_id)`,
  ],
  [
    "Index: idx_support_tickets_status",
    `CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status)`,
  ],
  [
    "Index: idx_support_ticket_messages_ticket",
    `CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id)`,
  ],
]

async function run() {
  let client
  try {
    log("[Migration] Connecting to Neon Postgres...")
    client = await pool.connect()
    log("[Migration] Connected. Running idempotent steps...")

    for (let i = 0; i < STEPS.length; i++) {
      const [label, sql] = STEPS[i]
      log(`  → Step ${i + 1}/${STEPS.length}: ${label}`)
      try {
        await client.query(sql)
        log(`     ✅ OK`)
      } catch (e) {
        const msg = e.message || ""
        if (
          msg.includes("already exists") ||
          msg.includes("duplicate key") ||
          msg.includes("does not exist") && label.startsWith("Index:")
        ) {
          log(`     ⚠️  Skipped (harmless): ${msg}`)
        } else {
          log(`     ❌ FAILED: ${msg}`)
          throw new Error(`Step "${label}" failed: ${msg}`)
        }
      }
    }

    log("[Migration] ✅ All steps completed on Neon Postgres.")
  } catch (e) {
    log(`[Migration] ❌ FAILED overall: ${e.message}`)
    log(e.stack || "")
    process.exitCode = 1
  } finally {
    if (client) client.release()
    try {
      await pool.end()
    } catch {}
    fs.writeFileSync(path.join(__dirname, "..", "migration-output.txt"), logLines.join("\n"), "utf-8")
  }
}

run()
