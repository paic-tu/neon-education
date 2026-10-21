import { requirePermission } from "@/lib/rbac/require-permission"
import { db } from "@/lib/db"
import { users, enrollments, orders, certificates, challengeSubmissions } from "@/lib/db/schema"
import { eq, count, and } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { UserEditForm } from "@/components/admin/user-edit-form"
import { UserResetPasswordButton } from "@/components/admin/user-reset-password-button"
import { hasPermission } from "@/lib/rbac/permissions"

export default async function UserDetailPage({ params }: { params: Promise<{ id: string; lang: string }> }) {
  const { id, lang } = await params

  if (id === "new") {
    redirect(`/${lang}/admin/users/new`)
  }

  const currentUser = await requirePermission("users:read")
  const canResetPassword = hasPermission(currentUser.role as any, "users:write")

  let userId: string = id
  
  if (!userId || userId.length < 10) { 
    notFound()
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId)
  })

  if (!user) {
    notFound()
  }

  // Get user stats
  const [enrollmentStats, orderStats, certificateStats, challengeStats] = await Promise.all([
    db.select({ count: count() }).from(enrollments).where(eq(enrollments.userId, userId)),
    db.select({ count: count() }).from(orders).where(eq(orders.userId, userId)),
    db.select({ count: count() }).from(certificates).where(and(eq(certificates.userId, userId), eq(certificates.status, 'issued'))),
    db.select({ count: count() }).from(challengeSubmissions).where(and(eq(challengeSubmissions.userId, userId), eq(challengeSubmissions.isPassed, true)))
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${lang}/admin/users`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{user.name}</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {canResetPassword && (
            <UserResetPasswordButton userId={user.id} userEmail={user.email} />
          )}
          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
            {user.role}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrollmentStats[0]?.count || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats[0]?.count || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{certificateStats[0]?.count || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Challenges Solved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{challengeStats[0]?.count || 0}</div>
          </CardContent>
        </Card>

      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent>
          <UserEditForm user={user} />
        </CardContent>
      </Card>
    </div>
  )
}
