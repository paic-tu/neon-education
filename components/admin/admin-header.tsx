"use client"

import type React from "react"
import { useState } from "react"
import type { User } from "@/lib/types"
import { Bell, Search, LogOut, Menu, Moon, Sun, Globe, FileText, Home, User as UserIcon } from "lucide-react"
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
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { useTheme } from "@/lib/theme-context"
import { hasPermission } from "@/lib/rbac/permissions"

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"

interface AdminHeaderProps {
  user: User
  mobileNav?: React.ReactNode
}

export function AdminHeader({ user, mobileNav }: AdminHeaderProps) {
  const router = useRouter()
  const { logout } = useAuth()
  const { language, setLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex flex-1 items-center gap-4">
        {mobileNav && (
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side={language === "ar" ? "right" : "left"} className="p-0 w-72">
              <div 
                className="h-full" 
                onClick={(e) => {
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

        <div className="relative w-96 hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-9" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {hasPermission(user.role as any, "lessons:write" as any) && (
          <Button
            variant="outline"
            className="hidden md:inline-flex"
            onClick={() => router.push(`/${language}/admin/assignments/new`)}
          >
            <FileText className="h-4 w-4 mr-2" />
            {language === "ar" ? "إضافة واجب" : "Add assignment"}
          </Button>
        )}
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

        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatarUrl || "/default-avatar.svg"} alt={user.name} />
                <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="text-left">
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
            <DropdownMenuItem onClick={() => router.push(`/${language}/admin/profile`)}>
              <UserIcon className="mr-2 h-4 w-4" />
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
