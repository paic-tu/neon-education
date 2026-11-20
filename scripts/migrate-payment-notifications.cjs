const { loadEnvConfig } = require("@next/env")
const { Client } = require("pg")
const { readFileSync } = require("node:fs")
const path = require("node:path")

loadEnvConfig(path.resolve(__dirname, ".."))

async function main() {
  if (!process.argv.includes("--apply")) {
    console.log("Use --apply to add payment email notification and recovery tables.")
    return
  }
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!connectionString) throw new Error("Database configuration is required")
  const client = new Client({ connectionString, connectionTimeoutMillis: 20000 })
  await client.connect()
  try {
    await client.query("BEGIN")
    await client.query(readFileSync(path.join(__dirname, "../lib/db/migrations/0012_add_payment_email_notifications.sql"), "utf8"))
    await client.query(readFileSync(path.join(__dirname, "../lib/db/migrations/0013_add_payment_email_recovery.sql"), "utf8"))
    await client.query(readFileSync(path.join(__dirname, "../lib/db/migrations/0016_add_ticket_email_notifications.sql"), "utf8"))
    await client.query(readFileSync(path.join(__dirname, "../lib/db/migrations/0017_monitor_existing_ticket_emails.sql"), "utf8"))
    await client.query("COMMIT")
    console.log("Payment email notification migration applied.")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("Payment email migration failed:", error.code || error.name)
  process.exitCode = 1
})
