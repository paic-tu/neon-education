"use client"

import Link from "next/link"
// import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  User,
  Settings,
  PlusCircle,
  BarChart,
  HelpCircle,
  MessageCircle,
  Video,
  FileText,
  Headphones,
} from "lucide-react"

function InstructorNav({ isCollapsed, unreadCount = 0 }: { isCollapsed?: boolean, unreadCount?: number }) {
  const pathname = usePathname()
  const segments = pathname.split("/")
  const locale = segments[1] || "ar"
  const pathWithoutLocale = "/" + segments.slice(2).join("/")
  const isAr = locale === "ar"
  const [liveCourses, setLiveCourses] = useState<Array<{ id: string; titleEn: string; titleAr: string }>>([])
  const [loadingLive, setLoadingLive] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    const fetchLive = async (isInitial = false) => {
      try {
        if (isInitial) setLoadingLive(true)
        const res = await fetch("/api/live/courses", { signal: controller.signal })
        const data = await res.json()
        const next = (data?.courses || []).slice(0, 10)
        setLiveCourses(next)
        return Array.isArray(next) ? next.length : 0
      } catch {
        return null
      } finally {
        if (isInitial) setLoadingLive(false)
      }
    }

    const schedule = async (isInitial = false) => {
      if (stopped) return
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        timeout = setTimeout(() => schedule(false), 60_000)
        return
      }
      const count = await fetchLive(isInitial)
      const nextDelay = typeof count === "number" ? (count > 0 ? 10_000 : 120_000) : 60_000
      timeout = setTimeout(() => schedule(false), nextDelay)
    }

    const onVisibility = () => {
      if (typeof document === "undefined") return
      if (document.visibilityState === "visible") {
        if (timeout) clearTimeout(timeout)
        schedule(false)
      }
    }

    schedule(true)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stopped = true
      controller.abort()
      if (timeout) clearTimeout(timeout)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const navGroups = [
    {
      id: "main",
      titleAr: "الرئيسية",
      titleEn: "Main",
      items: [
        {
          href: "/instructor/dashboard",
          label: isAr ? "لوحة التحكم" : "Dashboard",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      id: "courses",
      titleAr: "الدورات",
      titleEn: "Courses",
      items: [
        {
          href: "/instructor/courses",
          label: isAr ? "دوراتي" : "My Courses",
          icon: BookOpen,
        },
      ],
    },
    {
      id: "community",
      titleAr: "المجتمع",
      titleEn: "Community",
      items: [
        {
          href: "/instructor/chat",
          label: isAr ? "المحادثات" : "Chat",
          icon: MessageCircle,
        },
        {
          href: "/instructor/reviews",
          label: isAr ? "المراجعات" : "Reviews",
          icon: MessageSquare,
        },
      ],
    },
    {
      id: "insights",
      titleAr: "الإحصائيات",
      titleEn: "Insights",
      items: [
        {
          href: "/instructor/analytics",
          label: isAr ? "التحليلات" : "Analytics",
          icon: BarChart,
        },
      ],
    },
    {
      id: "support",
      titleAr: "الدعم",
      titleEn: "Support",
      items: [
        {
          href: "/instructor/support",
          label: isAr ? "الدعم الفني" : "Support",
          icon: Headphones,
        },
      ],
    },
  ]
  // "إنشاء دورة"، "الواجبات"، "الكويزات" أُزيلت من القائمة الرئيسية بقرار المستخدم —
  // مكانها المستهدف لاحقًا هو لوحة تحكم الدورة (per-course dashboard)، وصفحاتها
  // (/instructor/courses/new, /instructor/assignments, /instructor/quizzes) لم تُحذف ولا تزال تعمل.

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-4">
      {navGroups.map((group) => (
        <div key={group.id} className={cn(!isCollapsed && "mt-4 pt-4 border-t")}>
          {!isCollapsed && (
            <div className="px-3 pb-2 text-xs font-semibold text-muted-foreground">
              {isAr ? group.titleAr : group.titleEn}
            </div>
          )}
          {group.items.map((item) => {
            const Icon = item.icon
            const isActive = pathWithoutLocale === item.href || pathWithoutLocale.startsWith(item.href + "/")
            const hrefWithLocale = `/${locale}${item.href}`

            return (
              <Link
                key={item.href}
                href={hrefWithLocale}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors relative",
                  isActive
                    ? "bg-indigo-100 text-indigo-900"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isCollapsed && "justify-center px-2",
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5" />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
                {item.href === "/instructor/chat" && unreadCount > 0 && (
                  <span
                    className={cn(
                      "bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center",
                      isCollapsed ? "absolute -top-1 -right-1 h-4 w-4" : "ml-auto h-5 w-5",
                    )}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
      
      {/*
        قسم "الاستشارات التقنية" و "الدورات المباشرة" أُزيلا من هنا بقرار المستخدم.
        منطق الاستطلاع liveCourses/loadingLive أعلاه مُحتفظ به مؤقتًا فقط.
      */}

      <div className={cn(!isCollapsed && "mt-4 pt-4 border-t")}>
        {!isCollapsed && (
          <div className="px-3 pb-2 text-xs font-semibold text-muted-foreground">
            {isAr ? "الحساب" : "Account"}
          </div>
        )}
        {[
          {
            href: "/instructor/profile",
            label: isAr ? "الملف الشخصي" : "Profile",
            icon: User,
          },
          {
            href: "/instructor/settings",
            label: isAr ? "الإعدادات" : "Settings",
            icon: Settings,
          },
        ].map((item) => {
          const Icon = item.icon
          const isActive = pathWithoutLocale === item.href || pathWithoutLocale.startsWith(item.href + "/")
          const hrefWithLocale = `/${locale}${item.href}`
          return (
            <Link
              key={item.href}
              href={hrefWithLocale}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors relative",
                isActive
                  ? "bg-indigo-100 text-indigo-900"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                isCollapsed && "justify-center px-2",
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getUnreadMessageCount } from "@/lib/actions/chat"

export function InstructorSidebar() {
  const pathname = usePathname()
  const segments = pathname.split("/")
  const locale = segments[1] || "ar"
  const isAr = locale === "ar"
  
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const count = await getUnreadMessageCount()
        setUnreadCount(count)
      } catch (error) {
        console.error("Failed to fetch unread count:", error)
      }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 10000)
    return () => clearInterval(interval)
  }, [])

  // Load state from local storage
  useEffect(() => {
    setMounted(true)
    const storedState = localStorage.getItem("instructor-sidebar-collapsed")
    if (storedState) {
      setIsCollapsed(storedState === "true")
    }
  }, [])

  if (!mounted) {
    return (
      <aside className="hidden md:flex w-64 flex-col border-r bg-background h-screen sticky top-0">
        <div className="flex h-16 items-center border-b px-6">
          <Link href={`/${locale}/instructor/dashboard`} className="flex items-center gap-2 font-bold text-xl">
            <span>{isAr ? "لوحة المدرب" : "Instructor"}</span>
          </Link>
        </div>
        <InstructorNav unreadCount={0} />
      </aside>
    )
  }

  const toggleSidebar = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("instructor-sidebar-collapsed", String(newState))
  }

  return (
    <aside 
      className={cn(
        "hidden md:flex flex-col border-r bg-background h-screen sticky top-0 transition-all duration-300",
        isCollapsed ? "w-[70px]" : "w-64"
      )}
    >
      <div className={cn("flex h-16 items-center border-b", isCollapsed ? "justify-center" : "px-6 justify-between")}>
        {!isCollapsed && (
          <Link href={`/${locale}/instructor/dashboard`} className="flex items-center gap-2 font-bold text-xl overflow-hidden whitespace-nowrap">
            <span>{isAr ? "لوحة المدرب" : "Instructor"}</span>
          </Link>
        )}
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar}
          className={cn("hover:bg-muted", isCollapsed ? "h-10 w-10" : "h-8 w-8")}
        >
          {isCollapsed ? (
             isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
             isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <InstructorNav isCollapsed={isCollapsed} unreadCount={unreadCount} />
      </div>
    </aside>
  )
}

export function InstructorMobileNav() {
  const pathname = usePathname()
  const segments = pathname.split("/")
  const locale = segments[1] || "ar"
  const isAr = locale === "ar"

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-16 items-center border-b px-6">
        <Link href={`/${locale}/instructor/dashboard`} className="flex items-center gap-2 font-bold text-xl">
          {/* <Image src="/logo.svg" alt="Neon Logo" width={40} height={40} className="h-8 w-auto" /> */}
          <span>{isAr ? "لوحة المدرب" : "Instructor"}</span>
        </Link>
      </div>
      <InstructorNav />
    </div>
  )
}
