"use client"

import type { ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { InstructorSidebar, InstructorMobileNav } from "@/components/instructor/instructor-sidebar"
import { PortalHeader } from "@/components/portal-header"
import { LiveSessionProvider } from "@/components/live-classroom-client"
import { cn } from "@/lib/utils"

interface InstructorPortalChromeProps {
  user: {
    name: string
    email: string
    role: string
    image?: string | null
  }
  children: ReactNode
}

export function InstructorPortalChrome({ user, children }: InstructorPortalChromeProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isCourseScopedNewForm =
    /\/instructor\/(assignments|quizzes)\/new$/.test(pathname) && Boolean(searchParams.get("courseId"))
  const insideCourseShell = /\/instructor\/courses\/[^/]+\/[^/]+/.test(pathname) || isCourseScopedNewForm

  return (
    <div className="relative z-10 flex h-screen overflow-hidden bg-muted">
      {!insideCourseShell && <InstructorSidebar />}
      <div className="flex flex-1 flex-col overflow-hidden">
        <PortalHeader user={user} mobileNav={insideCourseShell ? undefined : <InstructorMobileNav />} />
        <main className={cn("flex-1", insideCourseShell ? "overflow-hidden" : "overflow-y-auto p-6 scrollbar-hide")}>
          <LiveSessionProvider>{children}</LiveSessionProvider>
        </main>
      </div>
    </div>
  )
}
