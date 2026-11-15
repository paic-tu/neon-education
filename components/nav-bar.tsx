"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Moon,
  Sun,
  Globe,
  ShoppingCart,
  Menu,
  BookOpen,
  Trophy,
  Ticket,
  ShoppingBag,
  HelpCircle,
  Info,
  Phone,
  LayoutDashboard,
  User as UserIcon,
  LogIn,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { FloatingNavbar } from "@/components/ui/floating-navbar"
import { useLanguage } from "@/lib/language-context"
import { useTheme } from "@/lib/theme-context"
import { useAuth } from "@/lib/auth-context"
import { t } from "@/lib/i18n"
import { getCartCountAction } from "@/lib/actions"
import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export function NavBar() {
  const pathname = usePathname()
  const { language, setLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const [cartCount, setCartCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const dashboardLink = user?.role === "event_staff"
    ? `/${language}/events/check-in`
    : ["admin", "manager", "support"].includes(user?.role)
    ? `/${language}/admin`
    : user?.role === "instructor" 
      ? `/${language}/instructor/dashboard`
      : `/${language}/student/dashboard`

  useEffect(() => {
    let cancelled = false

    if (!user?.id) {
      setCartCount(0)
      return
    }

    getCartCountAction()
      .then((result) => {
        if (cancelled) return
        setCartCount(result.count ?? 0)
      })
      .catch(() => {
        if (cancelled) return
        setCartCount(0)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, pathname])

  const navItems = [
    { href: `/${language}/courses`, label: t("courses", language) },
    { href: `/${language}/challenges`, label: language === "ar" ? "التحديات" : "Challenges" },
    { href: `/${language}/store`, label: t("store", language) },
    { href: `/${language}/events`, label: language === "ar" ? "الفعاليات" : "Events" },
  ]
  const iconGapClass = language === "ar" ? "ml-2" : "mr-2"

  return (
    <FloatingNavbar dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex min-h-14 items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-4 lg:gap-6">
          <Link href={`/${language}`} className="flex shrink-0 items-center gap-2">
            {/* <Image src="/logo.svg" alt="Neon Logo" width={60} height={34} className="h-10 w-auto" /> */}
            <div className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent sm:text-2xl">
              {language === "ar" ? "نيون" : "Neon"}
            </div>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={[
                    "rounded-full px-3 font-semibold text-foreground/75 hover:bg-primary/10 hover:text-primary",
                    pathname === item.href ? "bg-primary/10 text-primary" : "",
                  ].join(" ")}
                >
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link href={`/${language}/cart`}>
            <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-primary/10 hover:text-primary">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </Link>

          <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10 hover:text-primary" onClick={toggleTheme}>
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-primary/10 hover:text-primary"
            onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
            aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
          >
            <Globe className="h-5 w-5" />
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden rounded-full border-primary/20 bg-background/70 font-semibold shadow-sm sm:inline-flex">
                  {user.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={dashboardLink}>{language === "ar" ? "لوحة التحكم" : "Dashboard"}</Link>
                </DropdownMenuItem>
                {user.role !== "event_staff" && <DropdownMenuItem asChild>
                  <Link href={user.role === "student" ? `/${language}/student/profile` : dashboardLink}>{t("profile", language)}</Link>
                </DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className={`${iconGapClass} h-4 w-4`} />
                  {t("logout", language)}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href={`/${language}/auth/login`} className="hidden sm:block">
              <Button size="sm" className="rounded-full px-4 font-semibold shadow-lg shadow-primary/15">
                {t("login", language)}
              </Button>
            </Link>
          )}

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-primary/10 hover:text-primary lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={language === "ar" ? "right" : "left"} className="w-4/5 max-w-sm p-0 sm:max-w-sm">
              <div dir={language === "ar" ? "rtl" : "ltr"} className="h-full flex flex-col">
              <div className="p-4 border-b bg-gradient-to-r from-primary/10 via-accent/10 to-background">
                <SheetHeader className="pb-0">
                  <SheetTitle className="text-base">{language === "ar" ? "القائمة" : "Menu"}</SheetTitle>
                </SheetHeader>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="p-3 grid gap-1.5">
                  <Link href={`/${language}/courses`} onClick={() => setMobileMenuOpen(false)}>
                    <Button variant={pathname.endsWith("/courses") ? "secondary" : "ghost"} className="w-full justify-start">
                      <BookOpen className={`${iconGapClass} h-4 w-4`} />
                      {t("courses", language)}
                    </Button>
                  </Link>
                  <Link href={`/${language}/challenges`} onClick={() => setMobileMenuOpen(false)}>
                    <Button variant={pathname.endsWith("/challenges") ? "secondary" : "ghost"} className="w-full justify-start">
                      <Trophy className={`${iconGapClass} h-4 w-4`} />
                      {language === "ar" ? "التحديات" : "Challenges"}
                    </Button>
                  </Link>
                  <Link href={`/${language}/store`} onClick={() => setMobileMenuOpen(false)}>
                    <Button variant={pathname.endsWith("/store") ? "secondary" : "ghost"} className="w-full justify-start">
                      <ShoppingBag className={`${iconGapClass} h-4 w-4`} />
                      {t("store", language)}
                    </Button>
                  </Link>
                  <Link href={`/${language}/events`} onClick={() => setMobileMenuOpen(false)}>
                    <Button variant={pathname.endsWith("/events") ? "secondary" : "ghost"} className="w-full justify-start">
                      <Ticket className={`${iconGapClass} h-4 w-4`} />
                      {language === "ar" ? "الفعاليات" : "Events"}
                    </Button>
                  </Link>
                  <div className="my-2 border-t" />

                  <Link href={`/${language}/about`} onClick={() => setMobileMenuOpen(false)}>
                    <Button variant={pathname.endsWith("/about") ? "secondary" : "ghost"} className="w-full justify-start">
                      <Info className={`${iconGapClass} h-4 w-4`} />
                      {language === "ar" ? "من نحن" : "About"}
                    </Button>
                  </Link>
                  <Link href={`/${language}/faq`} onClick={() => setMobileMenuOpen(false)}>
                    <Button variant={pathname.endsWith("/faq") ? "secondary" : "ghost"} className="w-full justify-start">
                      <HelpCircle className={`${iconGapClass} h-4 w-4`} />
                      {language === "ar" ? "الأسئلة الشائعة" : "FAQ"}
                    </Button>
                  </Link>
                  <Link href={`/${language}/contact`} onClick={() => setMobileMenuOpen(false)}>
                    <Button variant={pathname.endsWith("/contact") ? "secondary" : "ghost"} className="w-full justify-start">
                      <Phone className={`${iconGapClass} h-4 w-4`} />
                      {language === "ar" ? "تواصل معنا" : "Contact"}
                    </Button>
                  </Link>

                  <div className="my-2 border-t" />

                  {user ? (
                    <>
                      <Link href={dashboardLink} onClick={() => setMobileMenuOpen(false)}>
                        <Button className="w-full justify-start">
                          <LayoutDashboard className={`${iconGapClass} h-4 w-4`} />
                          {language === "ar" ? "لوحة التحكم" : "Dashboard"}
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <Link href={`/${language}/auth/login`} onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full justify-start">
                        <LogIn className={`${iconGapClass} h-4 w-4`} />
                        {t("login", language)}
                      </Button>
                    </Link>
                  )}

                  <div className="my-2 border-t" />

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={toggleTheme}>
                      {theme === "light"
                        ? language === "ar"
                          ? "الوضع الداكن"
                          : "Dark Mode"
                        : language === "ar"
                          ? "الوضع الفاتح"
                          : "Light Mode"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
                    >
                      {language === "ar" ? "English" : "العربية"}
                    </Button>
                  </div>

                  {user && (
                    <>
                      <div className="my-2 border-t" />

                      <Button
                        variant="outline"
                        className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          setMobileMenuOpen(false)
                          logout()
                        }}
                      >
                        <LogOut className={`${iconGapClass} h-4 w-4`} />
                        {t("logout", language)}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </FloatingNavbar>
  )
}
