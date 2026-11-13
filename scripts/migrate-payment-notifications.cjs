const { loadEnvConfig } = require("@next/env")
const { Client } = require("pg")
const { readFileSync } = require("node:fs")
const path = require("node:path")

loadEnvConfig(path.resolve(__dirname, ".."))

async function main() {
  if (!process.argv.includes("--apply")) {
    console.log("Use --apply to add the payment email notification table.")
    return
  }
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!connectionString) throw new Error("Database configuration is required")
  const client = new Client({ connectionString, connectionTimeoutMillis: 20000 })
  await client.connect()
  try {
    await client.query(readFileSync(path.join(__dirname, "../lib/db/migrations/0012_add_payment_email_notifications.sql"), "utf8"))
    console.log("Payment email notification migration applied.")
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("Payment email migration failed:", error.code || error.name)
  process.exitCode = 1
})
