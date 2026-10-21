import type React from "react"
import type { Metadata, Viewport } from "next"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafcff" },
    { media: "(prefers-color-scheme: dark)", color: "#050609" },
  ],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const isAr = lang === "ar"

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://neonedu.org'),
    applicationName: "منصة نيون",
    title: {
      default: isAr
        ? "منصة نيون التعليمية | التجربة التعليمية بالذكاء الاصطناعي"
        : "Neon Learning Platform | Accredited Tech Courses & Certificates",
      template: isAr ? "%s | منصة نيون" : "%s | Neon Learning Platform"
    },
    description: isAr 
      ? "منصة نيون التعليمية منصة تعليم إلكتروني عربية تقدّم دورات وشهادات تقنية معتمدة في البرمجة وتطوير الويب وتحليل البيانات، بمسارات عملية يقدّمها مدربون خبراء." 
      : "Neon Learning Platform is an Arabic e-learning platform offering accredited tech courses and certificates in programming, web development and data analysis, taught by expert instructors.",
    keywords: [
      "منصة نيون التعليمية", "نيون التعليمية", "منصة نيون", "دورات اونلاين", "شهادات معتمدة",
      "تعليم", "دورات", "برمجة", "نيون", "education", "courses", "programming", "neon",
      "Neon Learning Platform", "web development", "tech", "learning platform", "online courses", "elearning", "منصة تعليمية"
    ],
    authors: [{ name: "منصة نيون التعليمية" }],
    creator: "منصة نيون التعليمية",
    publisher: "منصة نيون التعليمية",
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
        { url: '/icons/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      ],
      shortcut: '/favicon.ico',
      apple: [
        { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      ],
      other: [
        {
          rel: 'mask-icon',
          url: '/icon.svg',
          color: '#5bbad5' // You can customize this color
        },
      ],
    },
    manifest: '/manifest.json',
    openGraph: {
      type: "website",
      locale: isAr ? "ar_SA" : "en_US",
      alternateLocale: isAr ? ["en_US"] : ["ar_SA"],
      url: `/${lang}`,
      title: isAr ? "منصة نيون" : "Neon Learning Platform",
      description: isAr 
        ? "منصة نيون التعليمية منصة تعليم إلكتروني عربية تقدّم دورات وشهادات تقنية معتمدة في البرمجة والتقنية" 
        : "Neon Learning Platform is an Arabic e-learning platform offering accredited tech courses and certificates",
      siteName: isAr ? "منصة نيون" : "Neon Learning Platform",
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'منصة نيون',
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: isAr ? "منصة نيون" : "Neon Learning Platform",
      description: isAr 
        ? "منصة نيون التعليمية منصة تعليم إلكتروني عربية تقدّم دورات وشهادات تقنية معتمدة" 
        : "Neon Learning Platform offers accredited tech courses and certificates",
      creator: "@eduneonsa",
      images: ['/og-image.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: `/${lang}`,
      languages: {
        'en-US': '/en',
        'ar-SA': '/ar',
      },
    },
  }
}

export async function generateStaticParams() {
  return [{ lang: "ar" }, { lang: "en" }]
}

export default async function LangLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ lang: string }>
}>) {
  const { lang } = await params
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://neonedu.org').replace(/\/+$/, '')

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        '@id': `${baseUrl}/#organization`,
        name: 'منصة نيون التعليمية',
        alternateName: 'Neon Learning Platform',
        url: baseUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/icons/icon-512.png`,
        },
        sameAs: [
          'https://www.linkedin.com/company/neon-edu-sa/',
          'https://x.com/eduneonsa',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        url: baseUrl,
        name: 'منصة نيون التعليمية',
        alternateName: 'Neon Learning Platform',
        inLanguage: lang === 'en' ? 'en-US' : 'ar-SA',
        publisher: { '@id': `${baseUrl}/#organization` },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {children}
    </>
  )
}
