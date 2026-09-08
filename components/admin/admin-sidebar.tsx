"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
// import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ShoppingCart,
  Trophy,
  Award,
  Settings,
  FileText,
  BookOpen,
  Zap,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  MessageCircle,
  Video,
  MessageSquare,
  ClipboardCheck,
  Headphones,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { User } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac/permissions"
import { streamPayNavGroups } from "@/lib/admin/stream-pay-nav"

interface AdminSidebarProps {
  user: User
  isCollapsed?: boolean
}

function AdminNav({ user, isCollapsed }: AdminSidebarProps) {
  const pathname = usePathname()
  const segments = pathname.split("/")
  const locale = segments[1] || "ar"
  const isAr = locale === "ar"
  const [liveCourses, setLiveCourses] = useState<Array<{ id: string; titleEn: string; titleAr: string }>>([])
  const [loadingLive, setLoadingLive] = useState(false)
  
  // Helper to remove locale from path for comparison
  const pathWithoutLocale = "/" + segments.slice(2).join("/")
  const isStreamPay = pathWithoutLocale === "/admin/stream-pay" || pathWithoutLocale.startsWith("/admin/stream-pay/")

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
          href: "/admin",
          label: isAr ? "لوحة التحكم" : "Dashboard",
          icon: LayoutDashboard,
          permission: null,
        },
      ],
    },
    {
      id: "content",
      titleAr: "المحتوى",
      titleEn: "Content",
      items: [
        {
          href: "/admin/courses",
          label: isAr ? "الدورات" : "Courses",
          icon: GraduationCap,
          permission: "courses:read" as const,
        },
        {
          href: "/admin/course-reviews",
          label: isAr ? "مراجعة الدورات" : "Course Reviews",
          icon: ClipboardCheck,
          permission: "courses:approve" as const,
        },
        {
          href: "/admin/lessons",
          label: isAr ? "الدروس" : "Lessons",
          icon: BookOpen,
          permission: "lessons:read" as const,
        },
        {
          href: "/admin/assignments",
          label: isAr ? "الواجبات" : "Assignments",
          icon: FileText,
          permission: "lessons:read" as const,
        },
        {
          href: "/admin/categories",
          label: isAr ? "الأقسام" : "Categories",
          icon: BookOpen,
          permission: "courses:write" as const,
        },
        {
          href: "/admin/enrollments",
          label: isAr ? "التسجيلات" : "Enrollments",
          icon: Users,
          permission: "enrollments:read" as const,
        },
        {
          href: "/admin/ibm-submissions",
          label: isAr ? "طلبات IBM" : "IBM Submissions",
          icon: FileText,
          permission: "courses:read" as const,
        },
      ],
    },
    {
      id: "commerce",
      titleAr: "المبيعات",
      titleEn: "Commerce",
      items: [
        {
          href: "/admin/store",
          label: isAr ? "المتجر" : "Store",
          icon: ShoppingCart,
          permission: "store:read" as const,
        },
        {
          href: "/admin/orders",
          label: isAr ? "الطلبات" : "Orders",
          icon: FileText,
          permission: "orders:read" as const,
        },
        {
          href: "/admin/stream-pay",
          label: "Stream Pay",
          icon: CreditCard,
          permission: "store:read" as const,
        },
      ],
    },
    {
      id: "engagement",
      titleAr: "التواصل",
      titleEn: "Engagement",
      items: [
        {
          href: "/admin/consultations",
          label: isAr ? "الاستشارات" : "Consultations",
          icon: MessageCircle,
          permission: "consultations:read" as const,
        },
        {
          href: "/admin/consultations/bookings",
          label: isAr ? "حجوزات الاستشارات" : "Consultation Bookings",
          icon: MessageCircle,
          permission: "consultations:read" as const,
        },
        {
          href: "/admin/reviews",
          label: isAr ? "المراجعات" : "Reviews",
          icon: MessageSquare,
          permission: "reviews:read" as const,
        },
        {
          href: "/admin/chat",
          label: isAr ? "المحادثات" : "Chat",
          icon: MessageCircle,
          permission: null,
        },
        {
          href: "/admin/contests",
          label: isAr ? "المسابقات" : "Contests",
          icon: Trophy,
          permission: "contests:read" as const,
        },
        {
          href: "/admin/challenges",
          label: isAr ? "التحديات" : "Challenges",
          icon: Zap,
          permission: "challenges:read" as const,
        },
        {
          href: "/admin/quizzes",
          label: isAr ? "الكويزات" : "Quizzes",
          icon: HelpCircle,
          permission: "challenges:read" as const,
        },
        {
          href: "/admin/certificates",
          label: isAr ? "الشهادات" : "Certificates",
          icon: Award,
          permission: "certificates:read" as const,
        },
        {
          href: "/admin/support",
          label: isAr ? "الدعم الفني" : "Support",
          icon: Headphones,
          permission: "support:read" as const,
        },
      ],
    },
    {
      id: "access",
      titleAr: "المستخدمون",
      titleEn: "Users",
      items: [
        {
          href: "/admin/users",
          label: isAr ? "المستخدمين والصلاحيات" : "Users & Roles",
          icon: Users,
          permission: "users:read" as const,
        },
      ],
    },
    {
      id: "system",
      titleAr: "النظام",
      titleEn: "System",
      items: [
        {
          href: "/admin/settings",
          label: isAr ? "الإعدادات" : "Settings",
          icon: Settings,
          permission: "settings:read" as const,
        },
        {
          href: "/admin/audit-logs",
          label: isAr ? "سجلات التدقيق" : "Audit Logs",
          icon: FileText,
          permission: "audit:read" as const,
        },
      ],
    },
  ]

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.permission) return true
        return hasPermission(user.role as any, item.permission)
      }),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-4">
      {isStreamPay ? (
        <>
          <Link
            href={`/${locale}/admin/stream-pay`}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathWithoutLocale === "/admin/stream-pay"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              isCollapsed && "justify-center px-2",
            )}
            title={isCollapsed ? "Stream Pay" : undefined}
          >
            <CreditCard className="h-5 w-5" />
            {!isCollapsed && <span>Stream Pay</span>}
          </Link>

          <Link
            href={`/${locale}/admin/stream-pay/billing-flow`}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathWithoutLocale === "/admin/stream-pay/billing-flow"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              isCollapsed && "justify-center px-2",
            )}
            title={isCollapsed ? (isAr ? "تدفق الفوترة الكامل" : "Full Billing Flow") : undefined}
          >
            <FileText className="h-5 w-5" />
            {!isCollapsed && <span>{isAr ? "تدفق الفوترة الكامل" : "Full Billing Flow"}</span>}
          </Link>

          <Link
            href={`/${locale}/admin`}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
              isCollapsed && "justify-center px-2",
            )}
            title={isCollapsed ? (isAr ? "رجوع" : "Back") : undefined}
          >
            <ChevronLeft className="h-5 w-5" />
            {!isCollapsed && <span>{isAr ? "رجوع للوحة الأدمن" : "Back to Admin"}</span>}
          </Link>

          {streamPayNavGroups.map((group) => (
            <div key={group.id} className={cn(!isCollapsed && "mt-4 pt-4 border-t")}>
              {!isCollapsed && (
                <div className="px-3 pb-2 text-xs font-semibold text-muted-foreground">
                  {isAr ? group.titleAr : group.titleEn}
                </div>
              )}
              {group.items.map((item) => {
                const hrefWithLocale = `/${locale}${item.href}`
                const isActive =
                  pathWithoutLocale === item.href || pathWithoutLocale.startsWith(item.href + "/")
                const label = isAr ? item.labelAr : item.labelEn
                return (
                  <Link
                    key={item.href}
                    href={hrefWithLocale}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      isCollapsed && "justify-center px-2",
                    )}
                    title={isCollapsed ? label : undefined}
                  >
                    <FileText className="h-4 w-4" />
                    {!isCollapsed && <span className="truncate">{label}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </>
      ) : (
        <>
          {visibleGroups.map((group) => (
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
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
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
          ))}
      
          {!isCollapsed && (
            <div className="mt-4 pt-4 border-t">
              <div className="px-3 pb-2 text-xs font-semibold text-muted-foreground">
                {isAr ? "الدورات المباشرة" : "Live Courses"}
              </div>
              {loadingLive && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {isAr ? "جاري التحميل..." : "Loading..."}
                </div>
              )}
              {liveCourses.map((c) => {
                const hrefWithLocale = `/${locale}/instructor/courses/${c.id}/live`
                const isActive = pathWithoutLocale.startsWith(`/instructor/courses/${c.id}/live`)
                return (
                  <Link
                    key={c.id}
                    href={hrefWithLocale}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-red-50 text-red-700"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Video className="h-4 w-4 text-red-600" />
                    <span className="truncate">{isAr ? c.titleAr : c.titleEn}</span>
                  </Link>
                )
              })}
              {!loadingLive && liveCourses.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {isAr ? "لا يوجد بث مباشر الآن" : "No live courses now"}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </nav>
  )
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname()
  const segments = pathname.split("/")
  const locale = segments[1] || "ar"
  const isAr = locale === "ar"

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const storedState = localStorage.getItem("admin-sidebar-collapsed")
    if (storedState) {
      setIsCollapsed(storedState === "true")
    }
  }, [])

  if (!mounted) {
    return (
      <aside className="hidden md:flex w-64 flex-col border-r bg-background h-screen sticky top-0">
        <div className="flex h-16 items-center border-b px-6">
          <Link href={`/${locale}/admin`} className="flex items-center gap-2 font-bold text-xl">
            {/* <Image src="/logo.svg" alt="Neon Logo" width={40} height={40} className="h-8 w-auto" /> */}
            <span>Neon Admin</span>
          </Link>
        </div>
        <AdminNav user={user} />
      </aside>
    )
  }

  const toggleSidebar = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("admin-sidebar-collapsed", String(newState))
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
          <Link href={`/${locale}/admin`} className="flex items-center gap-2 font-bold text-xl overflow-hidden whitespace-nowrap">
            <span>Neon Admin</span>
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
        <AdminNav user={user} isCollapsed={isCollapsed} />
      </div>
    </aside>
  )
}

export function AdminMobileNav({ user }: AdminSidebarProps) {
  const pathname = usePathname()
  const segments = pathname.split("/")
  const locale = segments[1] || "ar"

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-16 items-center border-b px-6">
        <Link href={`/${locale}/admin`} className="flex items-center gap-2 font-bold text-xl">
          {/* <Image src="/logo.svg" alt="Neon Logo" width={40} height={40} className="h-8 w-auto" /> */}
          <span>Neon Admin</span>
        </Link>
      </div>
      <AdminNav user={user} />
    </div>
  )
}
