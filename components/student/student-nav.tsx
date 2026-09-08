"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { t, Language } from "@/lib/i18n"
import {
  LayoutDashboard,
  BookOpen,
  Search,
  Award,
  Bookmark,
  User,
  Settings,
  Headphones,
} from "lucide-react"

export function StudentNav({ isCollapsed }: { isCollapsed?: boolean }) {
  const pathname = usePathname()
  const segments = pathname.split("/")
  const locale = (segments[1] || "ar") as Language
  const pathWithoutLocale = "/" + segments.slice(2).join("/")
  const isAr = locale === "ar"

  const navGroups = [
    {
      id: "main",
      titleAr: "الرئيسية",
      titleEn: "Main",
      items: [
        {
          href: "/student/dashboard",
          label: t("dashboard", locale),
          icon: LayoutDashboard,
        },
      ],
    },
    {
      id: "learning",
      titleAr: "التعلم",
      titleEn: "Learning",
      items: [
        {
          href: "/student/my-courses",
          label: t("myCourses", locale),
          icon: BookOpen,
        },
        {
          href: "/student/browse",
          label: t("browse", locale),
          icon: Search,
        },
        {
          href: "/student/certificates",
          label: t("certificates", locale),
          icon: Award,
        },
      ],
    },
    {
      id: "tools",
      titleAr: "الأدوات",
      titleEn: "Tools",
      items: [
        {
          href: "/student/bookmarks",
          label: t("bookmarks", locale),
          icon: Bookmark,
        },
        {
          href: "/student/support",
          label: isAr ? "الدعم الفني" : "Support",
          icon: Headphones,
        },
      ],
    },
    {
      id: "account",
      titleAr: "الحساب",
      titleEn: "Account",
      items: [
        {
          href: "/student/profile",
          label: t("profile", locale),
          icon: User,
        },
        {
          href: "/student/settings",
          label: t("settings", locale),
          icon: Settings,
        },
      ],
    },
  ]

  return (
    <nav className="flex-1 overflow-y-auto py-4">
      {navGroups.map((group) => (
        <div key={group.id} className={cn(!isCollapsed && "mt-4 pt-4 border-t")}>
          {!isCollapsed && (
            <div className="px-6 pb-2 text-xs font-semibold text-muted-foreground">
              {isAr ? group.titleAr : group.titleEn}
            </div>
          )}
          {group.items.map((item) => {
            const Icon = item.icon
            const itemPath = item.href.split("?")[0]
            const isActive = pathWithoutLocale === itemPath || pathWithoutLocale.startsWith(itemPath + "/")
            const hrefWithLocale = `/${locale}${item.href}`

            return (
              <Link
                key={item.href}
                href={hrefWithLocale}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors border-s-4 border-transparent",
                  isActive
                    ? "bg-primary/10 border-primary text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isCollapsed && "justify-center px-2 border-s-0",
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
