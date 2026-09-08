/**
 * Role-Based Access Control (RBAC) & Permissions System
 * Defines permissions, roles, and authorization helpers
 */

export type Permission =
  | "users:read"
  | "users:write"
  | "users:delete"
  | "users:ban"
  | "courses:read"
  | "courses:write"
  | "courses:delete"
  | "courses:publish"
  | "courses:approve"
  | "lessons:read"
  | "lessons:write"
  | "lessons:delete"
  | "enrollments:read"
  | "enrollments:write"
  | "enrollments:delete"
  | "store:read"
  | "store:write"
  | "store:delete"
  | "orders:read"
  | "orders:write"
  | "orders:refund"
  | "challenges:read"
  | "challenges:write"
  | "challenges:delete"
  | "contests:read"
  | "contests:write"
  | "contests:delete"
  | "certificates:read"
  | "certificates:write"
  | "certificates:revoke"
  | "settings:read"
  | "settings:write"
  | "audit:read"
  | "reviews:read"
  | "reviews:delete"
  | "docs:read"
  | "docs:write"
  | "consultations:read"
  | "consultations:write"
  | "support:read"
  | "support:write"
  | "support:manage"

export type Role = "student" | "instructor" | "admin" | "manager" | "support"

// Permission matrix by role
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    // Full access to everything
    "users:read",
    "users:write",
    "users:delete",
    "users:ban",
    "courses:read",
    "courses:write",
    "courses:delete",
    "courses:publish",
    "courses:approve",
    "lessons:read",
    "lessons:write",
    "lessons:delete",
    "enrollments:read",
    "enrollments:write",
    "enrollments:delete",
    "store:read",
    "store:write",
    "store:delete",
    "orders:read",
    "orders:write",
    "orders:refund",
    "challenges:read",
    "challenges:write",
    "challenges:delete",
    "contests:read",
    "contests:write",
    "contests:delete",
    "certificates:read",
    "certificates:write",
    "certificates:revoke",
    "settings:read",
    "settings:write",
    "audit:read",
    "reviews:read",
    "reviews:delete",
    "docs:read",
    "docs:write",
    "consultations:read",
    "consultations:write",
    "support:read",
    "support:write",
    "support:manage",
  ],
  manager: [
    // Content + store management, no system settings
    "users:read",
    "courses:read",
    "courses:write",
    "courses:publish",
    "courses:approve",
    "lessons:read",
    "lessons:write",
    "lessons:delete",
    "enrollments:read",
    "store:read",
    "store:write",
    "orders:read",
    "challenges:read",
    "challenges:write",
    "contests:read",
    "contests:write",
    "certificates:read",
    "docs:read",
    "consultations:read",
    "consultations:write",
    "support:read",
    "support:write",
    "support:manage",
  ],
  instructor: [
    // Own courses + lessons + grading only
    "courses:read",
    "courses:write", // Only own courses
    "lessons:read",
    "lessons:write",
    "lessons:delete",
    "enrollments:read",
    "challenges:read",
    "certificates:read",
    "docs:read",
    "support:read",
    "support:write",
  ],
  support: [
    // Users + orders + refunds, read-only settings
    "users:read",
    "users:write",
    "courses:read",
    "enrollments:read",
    "store:read",
    "orders:read",
    "orders:write",
    "orders:refund",
    "challenges:read",
    "contests:read",
    "certificates:read",
    "settings:read",
    "docs:read",
    "consultations:read",
    "support:read",
    "support:write",
    "support:manage",
  ],
  student: [
    // Normal user - no admin permissions
  ],
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p))
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

/**
 * Check if user has admin-level permissions
 */
export function isAdmin(role: Role): boolean {
  return role === "admin"
}

/**
 * Check if user can access admin panel
 */
export function canAccessAdmin(role: Role): boolean {
  // Strict separation: Instructors use /instructor portal
  return ["admin", "manager", "support"].includes(role)
}

/**
 * Check if user can manage lessons (create, edit, delete)
 */
export function canManageLessons(role: Role): boolean {
  return hasPermission(role, "lessons:write")
}

/**
 * Check if user can manage courses (create, edit, delete)
 */
export function canManageCourses(role: Role): boolean {
  return hasPermission(role, "courses:write")
}
