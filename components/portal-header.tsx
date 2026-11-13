"use client"

import { Bell, Search, LogOut, Menu, Moon, Sun, Globe, Home, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { useTheme } from "@/lib/theme-context"
import { useState, useEffect } from "react"
import { getUnreadMessageCount } from "@/lib/actions/chat"
import type React from "react"

interface PortalHeaderProps {
  user: {
    name: string
    email: string
    role: string
    image?: string | null
  }
  mobileNav?: React.ReactNode
}

export function PortalHeader({ user, mobileNav }: PortalHeaderProps) {
  const router = useRouter()
  const { logout } = useAuth()
  const { language, setLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
    // Poll every 10 seconds
    const interval = setInterval(fetchCount, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex flex-1 items-center gap-4">
        {mobileNav && (
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" suppressHydrationWarning>
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side={language === "ar" ? "right" : "left"} className="p-0 w-72">
              <div 
                className="h-full" 
                onClick={(e) => {
                  // Close sidebar when a link is clicked
                  if ((e.target as HTMLElement).closest('a')) {
                    setIsMobileMenuOpen(false)
                  }
                }}
              >
                {mobileNav}
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Search bar placeholder */}
        <div className="relative w-96 hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-9" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
        >
          <Globe className="h-5 w-5" />
        </Button>

        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          onClick={() =>
            router.push(
              user.role === "student"
                ? `/${language}/student/my-courses`
                : `/${language}/${user.role}/chat`
            )
          }
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white ring-1 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2" suppressHydrationWarning>
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.image || "/default-avatar.svg"} alt={user.name} />
                <AvatarFallback>{user.name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <div className="text-left hidden md:block">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {language === "ar"
                    ? user.role === "admin"
                      ? "مدير"
                      : user.role === "instructor"
                        ? "مدرب"
                        : "طالب"
                    : user.role}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{language === "ar" ? "حسابي" : "My Account"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(`/${language}/profile`)}>
              <User className="mr-2 h-4 w-4" />
              {language === "ar" ? "الملف الشخصي" : "Profile"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/${language}`)}
              className="text-green-600 focus:bg-green-600/10 focus:text-green-600"
            >
              <Home className="mr-2 h-4 w-4" />
              {language === "ar" ? "الصفحة الرئيسية" : "Home Page"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              {language === "ar" ? "تسجيل الخروج" : "Logout"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
