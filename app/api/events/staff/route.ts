import { NextResponse } from "next/server"
import { z } from "zod"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { EventError, requireEventUser, requireSameOrigin, resultRows } from "@/lib/events"

const assignmentSchema = z.object({ productId: z.string().uuid(), userId: z.string().uuid() }).strict()

async function changeAssignment(req: Request, remove: boolean) {
  try {
    requireSameOrigin(req)
    const actor = await requireEventUser(true)
    const raw = await req.text()
    if (raw.length > 2048) throw new EventError(413, "INVALID_DATA")
    let json: unknown
    try { json = JSON.parse(raw) } catch { throw new EventError(400, "INVALID_DATA") }
    const parsed = assignmentSchema.safeParse(json)
    if (!parsed.success) throw new EventError(400, "INVALID_DATA")
    const { productId, userId } = parsed.data
    const operation = remove
      ? sql`DELETE FROM event_staff_assignments
          WHERE product_id = ${productId}::uuid AND user_id = ${userId}::uuid
          AND EXISTS (SELECT 1 FROM users WHERE id = ${actor.id}::uuid AND role = 'admin' AND is_active)
          RETURNING product_id, user_id`
      : sql`INSERT INTO event_staff_assignments (product_id, user_id, assigned_by)
          SELECT p.id, u.id, ${actor.id}::uuid FROM products p CROSS JOIN users u
          WHERE p.id = ${productId}::uuid AND p.product_type = 'event_ticket'
            AND u.id = ${userId}::uuid AND u.role = 'event_staff' AND u.is_active
            AND EXISTS (SELECT 1 FROM users WHERE id = ${actor.id}::uuid AND role = 'admin' AND is_active)
          ON CONFLICT (product_id, user_id) DO UPDATE SET assigned_by = EXCLUDED.assigned_by
          RETURNING product_id, user_id`
    const result = resultRows(await db.execute(sql`
      WITH changed AS (${operation}), logged AS (
        INSERT INTO audit_logs (user_id, action, resource, resource_id, changes)
        SELECT ${actor.id}::uuid, ${remove ? "event_staff_removed" : "event_staff_assigned"},
          'event', product_id, jsonb_build_object('staffId', user_id)
        FROM changed RETURNING id
      ) SELECT id FROM logged
    `))
    if (!result.length) throw new EventError(400, "INVALID_ASSIGNMENT")
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const e = error instanceof EventError ? error : new EventError(500, "SERVER_ERROR")
    return NextResponse.json({ error: e.code }, { status: e.status, headers: { "Cache-Control": "no-store" } })
  }
}

export async function POST(req: Request) { return changeAssignment(req, false) }
export async function DELETE(req: Request) { return changeAssignment(req, true) }
