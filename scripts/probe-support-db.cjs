require("dotenv").config()
const { Pool } = require("pg")
const path = require("path")
const fs = require("fs")

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function probe() {
  const client = await pool.connect()
  const logs = []
  const log = (m) => { logs.push(String(m)); console.log(m) }

  try {
    log(`[Probe] Testing DB connection and schema...`)

    // 1) Check courses has approval cols (sanity)
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='courses' ORDER BY ordinal_position`
    )
    log(`[Probe] courses columns count = ${cols.rows.length}`)
    const neededCoursesCols = ["is_approved", "deletion_requested", "approved_by", "approved_at", "approval_note", "deletion_requested_at", "deletion_requested_reason", "deletion_reviewed_by", "deletion_reviewed_at", "deletion_rejected_reason"]
    for (const c of neededCoursesCols) {
      const exists = cols.rows.some((r) => r.column_name === c)
      log(`  - courses.${c}: ${exists ? "OK" : "❌ MISSING"}`)
    }

    // 2) check support tables
    for (const t of ["support_tickets", "support_ticket_messages"]) {
      const res = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='${t}') AS e`
      )
      log(`[Probe] table ${t} exists = ${res.rows[0].e}`)
    }

    // 3) describe support_tickets columns
    const tcols = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='support_tickets' ORDER BY ordinal_position`
    )
    log(`[Probe] support_tickets columns:`)
    for (const r of tcols.rows) {
      log(`    ${r.column_name.padEnd(32)} ${r.data_type.padEnd(20)} DEFAULT=${r.column_default || "null"}`)
    }

    // 4) check enums
    const enums = await client.query(`
      SELECT t.typname, e.enumlabel, e.enumsortorder
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname IN ('support_ticket_status','support_ticket_category')
      ORDER BY t.typname, e.enumsortorder
    `)
    log(`[Probe] enums found = ${enums.rows.length}`)
    const grouped = {}
    for (const r of enums.rows) grouped[r.typname] = (grouped[r.typname] || []).concat(r.enumlabel)
    log(JSON.stringify(grouped, null, 2))

    // 5) simple drizzle-style sanity select: list 3 most recent support tickets via raw SQL
    //    (this mimics support-queries.ts listSupportTickets JOIN)
    log(`[Probe] Running simulated JOIN query like listSupportTickets...`)
    try {
      const q = `
        SELECT st.id, st.subject_ar, st.subject_en, st.category, st.status,
               st.created_by_id, st.assigned_to_id, st.created_at, st.updated_at,
               cb.name AS created_by_name, at.name AS assigned_to_name
        FROM support_tickets st
        LEFT JOIN users cb ON cb.id = st.created_by_id
        LEFT JOIN users at ON at.id = st.assigned_to_id
        ORDER BY st.created_at DESC
        LIMIT 3
      `
      const r = await client.query(q)
      log(`  ✅ JOIN works, rows = ${r.rows.length}`)
      for (const row of r.rows) log(`    ${row.id.slice(0,8)}… status=${row.status} category=${row.category}`)
    } catch (e) {
      log(`  ❌ JOIN FAILED: ${e.message}`)
      log(e.stack)
    }

    // 6) Test specific common failures: is there a pg_enum mismatch?
    log(`[Probe] Final check — can we read users table?`)
    const u = await client.query(`SELECT id, name, role FROM users ORDER BY created_at DESC LIMIT 1`)
    log(`  ✅ users query OK, first=${JSON.stringify(u.rows[0])}`)

  } catch (e) {
    log(`[Probe] overall error: ${e.message}`)
    log(e.stack)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
    fs.writeFileSync(path.join(__dirname, "..", "probe-output.txt"), logs.join("\n"), "utf-8")
  }
}
probe()
