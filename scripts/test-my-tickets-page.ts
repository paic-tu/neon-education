import { test } from "node:test"
import assert from "node:assert/strict"
import Module from "node:module"
import { isValidElement, type ReactNode } from "react"
import { readFileSync } from "node:fs"

test("My Tickets requires login and uses each role's dashboard without filtering by order", async () => {
  let user: { id: string; name: string; email: string; role: string } | null = null
  const stub = () => null
  const student = () => null
  const instructor = () => null
  const admin = () => null
  const tickets = () => null
  const navbar = () => null
  const mocks: Record<string, unknown> = {
    "@/lib/auth": { getCurrentUser: async () => user },
    "next/navigation": { redirect: (url: string) => { throw new Error(`redirect:${url}`) } },
    "@/components/buyer-event-tickets": { BuyerEventTickets: tickets },
    "@/components/student/student-portal-chrome": { StudentPortalChrome: student },
    "@/components/instructor/instructor-portal-chrome": { InstructorPortalChrome: instructor },
    "@/components/admin/admin-sidebar": { AdminSidebar: admin, AdminMobileNav: stub },
    "@/components/admin/admin-header": { AdminHeader: stub },
    "@/components/nav-bar": { NavBar: navbar },
  }
  const original = (Module as any)._load
  const elements = (node: ReactNode): Array<{ type: unknown; props: Record<string, unknown> }> => {
    if (Array.isArray(node)) return node.flatMap(elements)
    if (!isValidElement<{ children?: ReactNode }>(node)) return []
    return [{ type: node.type, props: node.props }, ...elements(node.props.children)]
  }

  try {
    ;(Module as any)._load = function (request: string, ...args: unknown[]) {
      return request in mocks ? mocks[request] : original.call(this, request, ...args)
    }
    const { default: Page, metadata, dynamic } = await import("../app/[lang]/tickets/page")
    assert.equal(dynamic, "force-dynamic")
    assert.deepEqual(metadata.robots, { index: false, follow: false })
    await assert.rejects(() => Page({ params: Promise.resolve({ lang: "ar" }) }), /redirect:\/ar\/auth\/login\?callbackUrl=%2Far%2Ftickets/)

    for (const role of ["student", "instructor", "admin", "manager", "support", "event_staff"]) {
      user = { id: `buyer-${role}`, name: "Buyer", email: "buyer@example.com", role }
      for (const lang of ["ar", "en"]) {
        const tree = await Page({ params: Promise.resolve({ lang }) })
        const nodes = elements(tree)
        const expectedShell = role === "student" ? student : role === "instructor" ? instructor : role === "event_staff" ? navbar : admin
        assert.ok(nodes.some((node) => node.type === expectedShell), `${role}: correct shell`)
        const buyerNodes = nodes.filter((node) => node.type === tickets)
        assert.equal(buyerNodes.length, 1)
        assert.equal(buyerNodes[0].props.lang, lang)
        assert.equal(buyerNodes[0].props.orderId, undefined)
        assert.ok(nodes.some((node) => node.type === "h1" && node.props.children === (lang === "ar" ? "تذاكري" : "My Tickets")))
      }
    }
  } finally {
    ;(Module as any)._load = original
  }
})

test("Desktop and mobile shared dashboard menus expose personal tickets without management permissions", () => {
  for (const path of [
    "components/student/student-nav.tsx",
    "components/instructor/instructor-sidebar.tsx",
    "components/admin/admin-sidebar.tsx",
  ]) {
    const source = readFileSync(path, "utf8")
    assert.match(source, /href: "\/tickets",\s+label: isAr \? "تذاكري" : "My Tickets"/)
    if (path.includes("/admin/")) assert.match(source, /href: "\/tickets",[\s\S]*?permission: null/)
  }
  assert.match(readFileSync("app/[lang]/events/check-in/page.tsx", "utf8"), /href=\{`\/\$\{lang\}\/tickets`\}/)
})
