import { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://neonedu.org")
    .replace(/^http:\/\//i, "https://")
    .replace(/\/+$/, "")
  const now = new Date()

  const corePaths = [
    "",
    "/about",
    "/courses",
    "/store",
    "/pricing",
    "/mentors",
    "/cohorts",
    "/contact",
    "/faq",
    "/privacy",
    "/terms",
    "/content-policy",
  ]

  const urls: MetadataRoute.Sitemap = []

  for (const lang of ["ar", "en"] as const) {
    for (const path of corePaths) {
      const url = `${baseUrl}/${lang}${path}`
      urls.push({
        url,
        lastModified: now,
        changeFrequency: path === "" ? "daily" : "weekly",
        priority: path === "" ? 1 : 0.7,
      })
    }
  }

  urls.push({
    url: `${baseUrl}/`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 1,
  })

  return urls
}
