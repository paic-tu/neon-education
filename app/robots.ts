import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://neonedu.org")
    .replace(/^http:\/\//i, "https://")
    .replace(/\/+$/, "")
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/student/', '/instructor/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
