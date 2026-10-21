import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function ProfileRedirectPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const session = await auth()

  if (!session?.user) {
    redirect(`/${lang}/auth/login?callbackUrl=/${lang}/profile`)
  }

  const role = session.user.role

  if (role === "admin" || role === "manager" || role === "support") {
    redirect(`/${lang}/admin/profile`)
  } else if (role === "instructor") {
    redirect(`/${lang}/instructor/profile`)
  } else {
    // Default to student
    redirect(`/${lang}/student/profile`)
  }
}
