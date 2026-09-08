import "dotenv/config"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const MIGRATION_SQL = `
-- ===== 1) Add 10 Admin Approval / Deletion-Request columns to courses =====
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='is_approved') THEN
    ALTER TABLE courses ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='approved_at') THEN
    ALTER TABLE courses ADD COLUMN approved_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='approved_by') THEN
    ALTER TABLE courses ADD COLUMN approved_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='approval_note') THEN
    ALTER TABLE courses ADD COLUMN approval_note TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='deletion_requested') THEN
    ALTER TABLE courses ADD COLUMN deletion_requested BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='deletion_requested_at') THEN
    ALTER TABLE courses ADD COLUMN deletion_requested_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='deletion_requested_reason') THEN
    ALTER TABLE courses ADD COLUMN deletion_requested_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='deletion_reviewed_by') THEN
    ALTER TABLE courses ADD COLUMN deletion_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='deletion_reviewed_at') THEN
    ALTER TABLE courses ADD COLUMN deletion_reviewed_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='deletion_rejected_reason') THEN
    ALTER TABLE courses ADD COLUMN deletion_rejected_reason TEXT;
  END IF;
END $$;

-- Backfill existing published courses to approved (smooth transition for old rows)
UPDATE courses SET is_approved = true WHERE is_approved = false AND is_published = true;

-- ===== 2) Support Tickets: Enums + Tables =====
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='support_ticket_status') THEN
    CREATE TYPE support_ticket_status AS ENUM ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='support_ticket_category') THEN
    CREATE TYPE support_ticket_category AS ENUM ('technical', 'billing', 'course_content', 'account', 'other');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS support_tickets (
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
);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON support_tickets(created_by_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id);
`

async function run() {
  const client = await pool.connect()
  try {
    console.log("[Migration] Running approval + support-tickets migration...")
    await client.query("BEGIN")
    await client.query(MIGRATION_SQL)
    await client.query("COMMIT")
    console.log("[Migration] ✅ Success — all changes applied.")
  } catch (e) {
    await client.query("ROLLBACK")
    console.error("[Migration] ❌ Failed:", e)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
