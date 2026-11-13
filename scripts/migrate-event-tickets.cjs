const { loadEnvConfig } = require("@next/env")
const { Client } = require("pg")
const { readFileSync } = require("node:fs")
const path = require("node:path")

loadEnvConfig(path.resolve(__dirname, ".."))

async function main() {
  if (!process.argv.includes("--apply")) {
    console.log("Run with --apply to add event ticket tables, role and capacity guard. No existing data is deleted.")
    return
  }
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED
  if (!connectionString) throw new Error("A PostgreSQL database URL is required")
  const client = new Client({ connectionString, connectionTimeoutMillis: 20000 })
  await client.connect()
  try {
    const source = readFileSync(path.join(__dirname, "../lib/db/migrations/0011_add_event_tickets.sql"), "utf8")
    const [role, tables] = source.split("--> statement-breakpoint")
    await client.query(role)
    await client.query("BEGIN")
    await client.query(tables)
    await client.query("COMMIT")
    console.log("Event ticket migration applied successfully.")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("Event migration failed:", error.message)
  process.exitCode = 1
})
