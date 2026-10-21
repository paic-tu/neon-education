import { getCurrentUser } from "@/lib/auth"
import { getUserProfile } from "@/lib/db/queries"
import { redirect } from "next/navigation"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Mail, ShieldCheck, UserCog } from "lucide-react"
import { SettingsForm } from "@/app/[lang]/student/settings/settings-form"

const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  admin: { ar: "مدير", en: "Admin" },
  manager: { ar: "مدير عام", en: "Manager" },
  support: { ar: "دعم فني", en: "Support" },
  instructor: { ar: "مدرب", en: "Instructor" },
  student: { ar: "طالب", en: "Student" },
}

function getInitials(name?: string) {
  if (!name) return "U"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "U"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default async function AdminProfilePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const isAr = lang === "ar"
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    redirect(`/${lang}/auth/login?callbackUrl=/${lang}/admin/profile`)
  }

  const profile = await getUserProfile(currentUser.id)
  const user: any = profile || currentUser
  const roleLabel = ROLE_LABELS[user.role as string] || { ar: user.role, en: user.role }

  const formatDate = (date: Date | string | null) => {
    if (!date) return isAr ? "غير محدد" : "N/A"
    return new Date(date).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      {/* Profile header */}
      <div className="overflow-hidden rounded-2xl border bg-background">
        <div className="relative h-32 w-full overflow-hidden bg-gradient-to-r from-primary/20 to-primary/5 sm:h-40">
          {user.coverUrl && (
            <Image src={user.coverUrl} alt={user.name || "Cover"} fill className="object-cover" priority />
          )}
        </div>
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="-mt-16 h-24 w-24 shrink-0 border-4 border-background shadow-lg sm:-mt-20">
              <AvatarImage src={user.avatarUrl || "/default-avatar.svg"} alt={user.name || "User"} />
              <AvatarFallback className="text-2xl">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{user.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {isAr ? roleLabel.ar : roleLabel.en}
                </Badge>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {isAr ? "انضم في" : "Joined"} {formatDate(user.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Account info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{isAr ? "معلومات الحساب" : "Account Info"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{isAr ? "البريد الإلكتروني" : "Email"}</p>
                <p className="truncate font-medium" title={user.email}>
                  {user.email}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{isAr ? "الدور" : "Role"}</p>
                <p className="font-medium">{isAr ? roleLabel.ar : roleLabel.en}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{isAr ? "تاريخ الانضمام" : "Joined"}</p>
                <p className="font-medium">{formatDate(user.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit profile */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              {isAr ? "تعديل الملف الشخصي" : "Edit Profile"}
            </CardTitle>
            <CardDescription>
              {isAr
                ? "قم بتحديث اسمك وصورتك الشخصية ومعلومات التواصل."
                : "Update your name, picture and contact information."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm user={user} lang={lang} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
