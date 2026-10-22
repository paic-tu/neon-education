"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { StudentSidebar, StudentMobileNav } from "@/components/student/student-sidebar"
import { PortalHeader } from "@/components/portal-header"
import { LiveSessionProvider } from "@/components/live-classroom-client"
import { cn } from "@/lib/utils"

interface StudentPortalChromeProps {
  user: {
    name: string
    email: string
    role: string
    image?: string | null
  }
  children: ReactNode
}

export function StudentPortalChrome({ user, children }: StudentPortalChromeProps) {
  const pathname = usePathname()
  // Inside a specific course — its dashboard tabs, the lesson player, or a
  // course-scoped assignment detail page — the course's own full-height,
  // collapsible sidebar takes over so there's only ever one menu on screen.
  const insideCourseShell = /\/student\/(course|learn|assignments)\/[^/]+/.test(pathname)

  return (
    <div className="relative z-10 flex h-screen overflow-hidden bg-muted">
      {!insideCourseShell && <StudentSidebar />}
      <div className="flex flex-1 flex-col overflow-hidden">
        <PortalHeader user={user} mobileNav={insideCourseShell ? undefined : <StudentMobileNav />} />
        <main className={cn("flex-1", insideCourseShell ? "overflow-hidden" : "overflow-y-auto p-6 scrollbar-hide")}>
          <LiveSessionProvider>{children}</LiveSessionProvider>
        </main>
      </div>
    </div>
  )
}
