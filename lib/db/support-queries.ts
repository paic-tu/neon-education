"use server"

import { db } from "@/lib/db"
import { supportTickets, supportTicketMessages, users, courses } from "@/lib/db/schema"
import { and, desc, eq, ilike, or, aliasedTable } from "drizzle-orm"
import { hasPermission } from "@/lib/rbac/permissions"

export type SupportTicketCategory = "technical" | "billing" | "course_content" | "account" | "other"
export type SupportTicketStatus = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed"

export interface SupportTicketFilters {
  status?: string | null
  category?: string | null
  priority?: string | null
  assignedToId?: string | null
  createdById?: string | null
  relatedCourseId?: string | null
  search?: string | null
}

const createdByUsers = aliasedTable(users, "created_by_users")
const assignedToUsers = aliasedTable(users, "assigned_to_users")

export interface SupportTicketRow {
  id: string
  subjectAr: string
  subjectEn: string
  descriptionAr: string
  descriptionEn: string
  category: SupportTicketCategory
  status: SupportTicketStatus
  priority: string
  createdById: string
  assignedToId: string | null
  relatedCourseId: string | null
  resolvedAt: Date | null
  closedAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdByName: string | null
  createdByAvatar: string | null
  createdByRole: string | null
  assignedToName: string | null
  assignedToAvatar: string | null
  assignedToRole: string | null
  relatedCourseTitleAr: string | null
  relatedCourseTitleEn: string | null
}

export async function listSupportTickets(
  sessionUserId: string,
  userRole: string,
  filters: SupportTicketFilters = {}
): Promise<SupportTicketRow[]> {
  const canManageAll = hasPermission(userRole as any, "support:manage")

  const conditions = []
  if (!canManageAll) {
    conditions.push(eq(supportTickets.createdById, sessionUserId))
  } else {
    if (filters.createdById) conditions.push(eq(supportTickets.createdById, filters.createdById))
    if (filters.assignedToId) conditions.push(eq(supportTickets.assignedToId, filters.assignedToId))
  }
  if (filters.status) conditions.push(eq(supportTickets.status, filters.status as any))
  if (filters.category) conditions.push(eq(supportTickets.category, filters.category as any))
  if (filters.priority) conditions.push(eq(supportTickets.priority, filters.priority))
  if (filters.relatedCourseId) conditions.push(eq(supportTickets.relatedCourseId, filters.relatedCourseId))
  if (filters.search) {
    conditions.push(
      or(
        ilike(supportTickets.subjectAr, `%${filters.search}%`),
        ilike(supportTickets.subjectEn, `%${filters.search}%`),
        ilike(supportTickets.descriptionAr, `%${filters.search}%`),
        ilike(supportTickets.descriptionEn, `%${filters.search}%`)
      )
    )
  }

  const rows = await db
    .select({
      id: supportTickets.id,
      subjectAr: supportTickets.subjectAr,
      subjectEn: supportTickets.subjectEn,
      descriptionAr: supportTickets.descriptionAr,
      descriptionEn: supportTickets.descriptionEn,
      category: supportTickets.category,
      status: supportTickets.status,
      priority: supportTickets.priority,
      createdById: supportTickets.createdById,
      assignedToId: supportTickets.assignedToId,
      relatedCourseId: supportTickets.relatedCourseId,
      resolvedAt: supportTickets.resolvedAt,
      closedAt: supportTickets.closedAt,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      createdByName: createdByUsers.name,
      createdByAvatar: createdByUsers.avatarUrl,
      createdByRole: createdByUsers.role,
      assignedToName: assignedToUsers.name,
      assignedToAvatar: assignedToUsers.avatarUrl,
      assignedToRole: assignedToUsers.role,
      relatedCourseTitleAr: courses.titleAr,
      relatedCourseTitleEn: courses.titleEn,
    })
    .from(supportTickets)
    .leftJoin(createdByUsers, eq(supportTickets.createdById, createdByUsers.id))
    .leftJoin(assignedToUsers, eq(supportTickets.assignedToId, assignedToUsers.id))
    .leftJoin(courses, eq(supportTickets.relatedCourseId, courses.id))
    .where(and(...conditions))
    .orderBy(desc(supportTickets.createdAt))
    .limit(100)

  return rows as SupportTicketRow[]
}

export interface SupportTicketMessageRow {
  id: string
  ticketId: string
  senderId: string
  content: string
  attachments: any[]
  isInternal: boolean
  createdAt: Date
  senderName: string | null
  senderAvatar: string | null
  senderRole: string | null
}

export async function listTicketMessages(
  sessionUserId: string,
  userRole: string,
  ticketId: string
): Promise<SupportTicketMessageRow[]> {
  const canManageAll = hasPermission(userRole as any, "support:manage")

  const ticket = await db.query.supportTickets.findFirst({
    where: eq(supportTickets.id, ticketId),
    columns: { createdById: true },
  })
  if (!ticket) return []
  if (!canManageAll && ticket.createdById !== sessionUserId) return []

  const showInternal = canManageAll

  const whereConditions: any[] = [eq(supportTicketMessages.ticketId, ticketId)]
  if (!showInternal) whereConditions.push(eq(supportTicketMessages.isInternal, false))

  const rows = await db
    .select({
      id: supportTicketMessages.id,
      ticketId: supportTicketMessages.ticketId,
      senderId: supportTicketMessages.senderId,
      content: supportTicketMessages.content,
      attachments: supportTicketMessages.attachments,
      isInternal: supportTicketMessages.isInternal,
      createdAt: supportTicketMessages.createdAt,
      senderName: users.name,
      senderAvatar: users.avatarUrl,
      senderRole: users.role,
    })
    .from(supportTicketMessages)
    .leftJoin(users, eq(supportTicketMessages.senderId, users.id))
    .where(and(...whereConditions))
    .orderBy(supportTicketMessages.createdAt)
    .limit(500)

  return (rows.filter((r) => (showInternal ? true : !r.isInternal)) as unknown) as SupportTicketMessageRow[]
}

export async function getSupportTicketById(
  sessionUserId: string,
  userRole: string,
  ticketId: string
): Promise<SupportTicketRow | null> {
  const canManageAll = hasPermission(userRole as any, "support:manage")

  const conditions = [eq(supportTickets.id, ticketId)]
  if (!canManageAll) conditions.push(eq(supportTickets.createdById, sessionUserId))

  const [row] = await db
    .select({
      id: supportTickets.id,
      subjectAr: supportTickets.subjectAr,
      subjectEn: supportTickets.subjectEn,
      descriptionAr: supportTickets.descriptionAr,
      descriptionEn: supportTickets.descriptionEn,
      category: supportTickets.category,
      status: supportTickets.status,
      priority: supportTickets.priority,
      createdById: supportTickets.createdById,
      assignedToId: supportTickets.assignedToId,
      relatedCourseId: supportTickets.relatedCourseId,
      resolvedAt: supportTickets.resolvedAt,
      closedAt: supportTickets.closedAt,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      createdByName: createdByUsers.name,
      createdByAvatar: createdByUsers.avatarUrl,
      createdByRole: createdByUsers.role,
      assignedToName: assignedToUsers.name,
      assignedToAvatar: assignedToUsers.avatarUrl,
      assignedToRole: assignedToUsers.role,
      relatedCourseTitleAr: courses.titleAr,
      relatedCourseTitleEn: courses.titleEn,
    })
    .from(supportTickets)
    .leftJoin(createdByUsers, eq(supportTickets.createdById, createdByUsers.id))
    .leftJoin(assignedToUsers, eq(supportTickets.assignedToId, assignedToUsers.id))
    .leftJoin(courses, eq(supportTickets.relatedCourseId, courses.id))
    .where(and(...conditions))
    .limit(1)

  return (row as SupportTicketRow) || null
}

export async function listSupportAssignees(): Promise<{ id: string; name: string; role: string | null }[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(
      or(
        eq(users.role, "admin"),
        eq(users.role, "manager"),
        eq(users.role, "support")
      )
    )
    .orderBy(users.name)
    .limit(200)
  return rows
}
