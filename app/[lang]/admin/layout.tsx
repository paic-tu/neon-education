import type React from "react"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { canAccessAdmin } from "@/lib/rbac/permissions"
import { AdminSidebar, AdminMobileNav } from "@/components/admin/admin-sidebar"
import { AdminHeader } from "@/components/admin/admin-header"
import { LiveSessionProvider } from "@/components/live-classroom-client"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const userPromise = Promise.race([
    getCurrentUser(),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 5000) // 5 second timeout
    }),
  ])

  const user = (await userPromise) as any

  if (!user) {
    redirect("/auth/login?redirect=/admin")
  }

  if (!canAccessAdmin(user.role as any)) {
    redirect("/?error=unauthorized")
  }

  return (
    <div className="relative z-10 flex min-h-screen bg-muted">
      <AdminSidebar user={user} />
      <div className="flex flex-1 flex-col">
        <AdminHeader user={user} mobileNav={<AdminMobileNav user={user} />} />
        <main className="flex-1 p-6">
          <LiveSessionProvider>{children}</LiveSessionProvider>
        </main>
      </div>
    </div>
  )
}
