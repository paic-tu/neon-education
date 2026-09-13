import { requirePermission } from "@/lib/rbac/require-permission"
import { getSiteSettings } from "@/lib/db/queries"
import { AdminSettingsForm } from "@/components/admin-settings-form"

export default async function SettingsPage(props: { params: Promise<{ lang: string }> }) {
  const params = await props.params
  const { lang } = params
  const isAr = lang === "ar"
  await requirePermission("settings:read")
  const settings = await getSiteSettings()

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-3xl font-bold">{isAr ? "إعدادات النظام" : "System Settings"}</h1>
        <p className="text-muted-foreground">
          {isAr
            ? "إدارة إعدادات المنصة والتكاملات — يوجد أزرار Generate لتوليد مفاتيح صحيحة"
            : "Configure platform settings — Generate buttons create valid keys"}
        </p>
      </div>
      <AdminSettingsForm initial={settings} />
    </div>
  )
}
