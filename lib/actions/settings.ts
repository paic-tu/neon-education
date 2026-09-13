"use server"

import { revalidatePath } from "next/cache"
import { requirePermission } from "@/lib/rbac/require-permission"
import { updateSiteSettings } from "@/lib/db/queries"

export async function saveSettingsAction(formData: FormData) {
  await requirePermission("settings:write")

  const onValue = (v: FormDataEntryValue | null) =>
    v === "on" || v === "true" || v === true

  const payload = {
    siteName: String(formData.get("siteName") || ""),
    supportEmail: String(formData.get("supportEmail") || ""),
    maintenanceMode: onValue(formData.get("maintenanceMode")),
    allowRegistration: onValue(formData.get("allowRegistration")),
    currency: String(formData.get("currency") || "SAR"),
    email: {
      smtpHost: formData.get("smtpHost") ? String(formData.get("smtpHost")) : undefined,
      smtpPort: formData.get("smtpPort") ? Number(formData.get("smtpPort")) || undefined : undefined,
      smtpUser: formData.get("smtpUser") ? String(formData.get("smtpUser")) : undefined,
      smtpPassword: formData.get("smtpPassword") ? String(formData.get("smtpPassword")) : undefined,
      notifications: onValue(formData.get("emailNotifications")),
    },
    features: {
      showStore: onValue(formData.get("showStore")),
      showMentors: onValue(formData.get("showMentors")),
      enableLive: onValue(formData.get("enableLive")),
    },
  }

  const res = await updateSiteSettings(payload)
  revalidatePath("/(admin)/[lang]/admin/settings", "page")
  revalidatePath("/ar/admin/settings")
  revalidatePath("/en/admin/settings")
  return res
}
