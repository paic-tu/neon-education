"use client"

import type { ReactNode } from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  FileText,
  StickyNote,
  MessageCircle,
  Video,
  UserCircle,
  Menu,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface CourseShellProps {
  lang: string
  courseId: string
  course: {
    titleAr: string
    titleEn: string
    thumbnailUrl: string | null
  }
  progress: number
  children: ReactNode
}

export function CourseShell({ lang, courseId, course, progress, children }: CourseShellProps) {
  const pathname = usePathname()
  const isAr = lang === "ar"
  const title = isAr ? course.titleAr : course.titleEn
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem("course-sidebar-collapsed")
    if (stored) setIsCollapsed(stored === "true")
  }, [])

  const toggleSidebar = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    localStorage.setItem("course-sidebar-collapsed", String(next))
  }

  const base = `/${lang}/student/course/${courseId}`
  const segments = pathname.split("/")
  const pathWithoutLocale = "/" + segments.slice(2).join("/")
  const baseWithoutLocale = `/student/course/${courseId}`
  const isLiveRoute =
    pathWithoutLocale === `${baseWithoutLocale}/live` || pathWithoutLocale.startsWith(`${baseWithoutLocale}/live/`)

  const navItems = [
    { suffix: "", label: isAr ? "المحتوى التعليمي" : "Content", icon: BookOpen },
    { suffix: "/assignments", label: isAr ? "الواجبات" : "Assignments", icon: FileText },
    { suffix: "/notes", label: isAr ? "الملاحظات" : "Notes", icon: StickyNote },
    { suffix: "/chat", label: isAr ? "المحادثات" : "Chat", icon: MessageCircle },
    { suffix: "/live", label: isAr ? "الجلسات المباشرة" : "Live Sessions", icon: Video },
    { suffix: "/instructor", label: isAr ? "المدرب" : "Instructor", icon: UserCircle },
  ]

  const isItemActive = (suffix: string) => {
    const itemPath = baseWithoutLocale + suffix
    if (suffix === "") return pathWithoutLocale === itemPath
    return pathWithoutLocale === itemPath || pathWithoutLocale.startsWith(itemPath + "/")
  }

  const BackIcon = isAr ? ArrowRight : ArrowLeft

  const NavList = ({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) => (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = isItemActive(item.suffix)
        return (
          <Link
            key={item.suffix}
            href={base + item.suffix}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors border-s-4 border-transparent",
              active
                ? "bg-primary/10 border-primary text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              collapsed && "justify-center px-2 border-s-0"
            )}
          >
            <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        )
      })}

      <Link
        href={`/${lang}/student/dashboard`}
        onClick={onNavigate}
        title={collapsed ? (isAr ? "بوابة الطالب" : "Student Portal") : undefined}
        className={cn(
          "mt-2 flex items-center gap-3 border-t border-s-4 border-s-transparent px-6 py-3 pt-5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2 border-s-0"
        )}
      >
        <BackIcon className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="truncate">{isAr ? "بوابة الطالب" : "Student Portal"}</span>}
      </Link>
    </nav>
  )

  return (
    <div className="flex h-full">
      {/* Desktop sidebar: full height, collapsible — same mechanics as the student portal's own sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-e bg-background h-full transition-all duration-300",
          mounted && isCollapsed ? "w-[70px]" : "w-64"
        )}
      >
        <div className={cn("flex h-16 items-center border-b shrink-0", mounted && isCollapsed ? "justify-center" : "px-6 justify-between")}>
          {(!mounted || !isCollapsed) && (
            <span className="truncate font-bold text-sm">{isAr ? "قائمة الدورة" : "Course Menu"}</span>
          )}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className={cn("hover:bg-muted shrink-0", isCollapsed ? "h-10 w-10" : "h-8 w-8")}
            >
              {isCollapsed ? (
                isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
              ) : (
                isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        <NavList collapsed={mounted && isCollapsed} />
      </aside>

      {/* Content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar: course thumbnail/title/progress + mobile menu trigger */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
              {course.thumbnailUrl ? (
                <Image src={course.thumbnailUrl} alt={title} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold sm:text-base">{title}</h1>
              <div className="mt-1 flex items-center gap-2">
                <Progress value={progress} className="h-1.5 w-24 sm:w-40" />
                <span className="shrink-0 text-[11px] text-muted-foreground">{progress}%</span>
              </div>
            </div>
          </div>

          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={isAr ? "left" : "right"} className="w-4/5 max-w-sm p-0 sm:max-w-sm">
              <div dir={isAr ? "rtl" : "ltr"} className="flex h-full flex-col">
                <div className="border-b p-4">
                  <SheetHeader className="pb-0">
                    <SheetTitle className="truncate text-base">{title}</SheetTitle>
                  </SheetHeader>
                </div>
                <NavList onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Scrollable page content */}
        <div className={cn("flex-1 scrollbar-hide", isLiveRoute ? "overflow-hidden p-0" : "overflow-y-auto p-6")}>
          {children}
        </div>
      </div>
    </div>
  )
}
