import { requirePermission } from "@/lib/rbac/require-permission"
import { db } from "@/lib/db"
import { orders, users } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { OrderActionsMenu } from "@/components/admin/order-actions-menu"
import { renderEmailRecoveryAlert } from "@/components/admin/email-recovery-alert"

export default async function OrdersManagementPage(props: { params: Promise<{ lang: string }> }) {
  const { lang } = await props.params
  await requirePermission("orders:read")

  const ordersData = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      totalAmount: orders.totalAmount,
      status: orders.status,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      user_name: users.name,
      user_email: users.email,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .orderBy(desc(orders.createdAt))
    .limit(100)

  const emailRecoveryAlert = await renderEmailRecoveryAlert({ lang })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Orders</h1>
        <p className="text-muted-foreground">Manage customer orders and refunds</p>
      </div>

      {emailRecoveryAlert}

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search orders..." className="pl-9" />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Orders ({ordersData.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersData.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">#{order.id}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{order.user_name}</p>
                      <p className="text-sm text-muted-foreground">{order.user_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{Number(order.totalAmount).toFixed(2)} SAR</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        order.status === "paid" || order.status === "delivered"
                          ? "default"
                          : order.status === "cancelled"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/${lang}/admin/orders/${order.id}`}>View</Link>
                      </Button>
                      <OrderActionsMenu orderId={order.id} currentStatus={order.status || "pending"} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
