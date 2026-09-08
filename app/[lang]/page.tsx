"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NavBar } from "@/components/nav-bar"
import { AnimatedCounter } from "@/components/animated-counter"
import { GlowBlob } from "@/components/glow-blob"
import Link from "next/link"
import { HomeFaqAccordion } from "@/components/home-faq-accordion"
import { BookOpen, Award, Users, Sparkles, Rocket, Zap, Clock, Star, HelpCircle } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { t } from "@/lib/i18n"
import { getLandingPageReviews, getLandingPageStats } from "@/lib/actions/stats"
import { getFaqItems } from "@/lib/content/faq"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Reveal } from "@/components/reveal"
import { RotatingWords } from "@/components/rotating-words"
import { HeroSplineGalaxy } from "@/components/hero-spline-galaxy"
import { NeonLogoSpline } from "@/components/neon-logo-spline"
import { StatsCard3D } from "@/components/stats-card-3d"
import { WhyNeonFlexCards } from "@/components/why-neon-flex-cards"
import Script from "next/script"

export default function HomePage() {
  const { language } = useLanguage()
  const isRTL = language === "ar"
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const baseUrl = "https://neonedu.org"
  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${baseUrl}/#organization`,
    name: "Neon",
    alternateName: "نيون",
    url: baseUrl,
    logo: `${baseUrl}/logo.svg`,
    description:
      language === "ar"
        ? "منصة نيون التعليمية للدورات والشهادات المعتمدة في البرمجة والتقنية."
        : "Neon educational platform for accredited courses and certificates in programming and technology.",
  }
  const [stats, setStats] = useState({
    courses: 0,
    students: 0,
    certificates: 0,
    satisfaction: 0,
    totalReviews: 0
  })
  const [reviews, setReviews] = useState<
    Array<{
      id: string
      rating: number
      comment: string | null
      userName: string | null
      userAvatarUrl: string | null
      courseTitleAr: string | null
      courseTitleEn: string | null
      createdAt: any
    }>
  >([])

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const data = await getLandingPageReviews()
        const fiveStarOnly = (data as any[]).filter((r) => Number(r.rating) === 5)
        setReviews(fiveStarOnly)
      } catch {
      }
    }

    getLandingPageStats().then(setStats)
    fetchReviews()

    const interval = setInterval(fetchReviews, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen relative">
      <NavBar />
      <Script id="ld-org" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(organizationLd)}
      </Script>

      <main className="overflow-hidden">
        <section className="relative overflow-hidden pt-20 pb-20 sm:pt-24 sm:pb-28 lg:pt-20 lg:pb-36">
          <div data-neon-glow-anchor="" className="pointer-events-none absolute inset-0" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <Reveal>
            <div className="max-w-5xl mx-auto text-center space-y-7 sm:space-y-8">
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-balance leading-[1.05] tracking-normal">
                <NeonLogoSpline
                  className="relative mx-auto -mt-4 mb-4 aspect-square w-[clamp(320px,85vw,380px)] sm:mt-0 sm:mb-0 sm:w-[400px]"
                />
                <br />
                <span className={`text-foreground ${isRTL ? "text-3xl" : "text-2xl"} sm:text-4xl md:text-5xl -mt-14 sm:-mt-14 lg:-mt-28 block leading-tight`}>
                  <span className="inline-flex flex-nowrap items-baseline justify-center gap-x-2 gap-y-1">
                    <span>
                      {isRTL ? "منصتك ل\u200D" : "Your platform for "}
                    </span>
                    <RotatingWords
                      marginInlineStart={isRTL ? "-2.20em" : "0.18em"}
                      words={
                        isRTL
                          ? [
                              { text: "التعلم", className: "bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent" },
                              { text: "النمو", className: "bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent" },
                              { text: "الابتكار", className: "bg-gradient-to-r from-fuchsia-500 to-pink-500 bg-clip-text text-transparent" },
                              { text: "النجاح", className: "bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent" },
                            ]
                          : [
                              { text: "Learning", className: "bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent" },
                              { text: "Growth", className: "bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent" },
                              { text: "Innovation", className: "bg-gradient-to-r from-fuchsia-500 to-pink-500 bg-clip-text text-transparent" },
                              { text: "Success", className: "bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent" },
                            ]
                      }
                    />
                  </span>
                </span>
              </h1>

              <p className="text-base sm:text-lg md:text-2xl text-muted-foreground text-balance max-w-3xl mx-auto -mt-2 sm:-mt-8 leading-7 sm:leading-8 md:leading-9">
                {isRTL
                  ? "اكتشف دورات تعليمية متميزة واحصل على شهادة إتمام معتمدة من المنصة مع أفضل المدربين"
                  : "Discover premium educational courses and earn certified certificates from the best instructors "}
              </p>

              <div className="flex w-full flex-row flex-wrap items-center justify-center gap-3 pt-3 sm:gap-4 sm:pt-5">
                <Link
                  href={
                    isAuthenticated
                      ? user?.role === "admin"
                        ? `/${language}/admin`
                        : user?.role === "instructor"
                          ? `/${language}/instructor/dashboard`
                          : `/${language}/student/dashboard`
                      : `/${language}/courses`
                  }
                  className="w-full min-[420px]:w-auto"
                >
                  <Button
                    size="lg"
                    className="group min-h-12 w-full min-w-[240px] rounded-lg px-8 text-base font-semibold shadow-lg shadow-primary/15 hover-lift hover-glow min-[420px]:w-auto sm:text-lg"
                  >
                    <Rocket className="h-5 w-5 mr-2 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:rotate-[-8deg]" />
                    {isAuthenticated
                      ? user?.role === "instructor"
                        ? isRTL
                          ? "بوابة المعلم"
                          : "Teacher Portal"
                        : user?.role === "admin"
                          ? isRTL
                            ? "لوحة التحكم"
                            : "Admin Dashboard"
                          : isRTL
                            ? "بوابة الطالب"
                            : "Student Portal"
                      : isRTL
                        ? "ابدأ رحلتك التعليمية"
                        : "Start Your Learning Journey"}
                  </Button>
                </Link>
                <Link href={`/${language}/coming-soon`} className="w-full min-[420px]:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="group min-h-12 w-full min-w-[240px] rounded-lg border-accent/40 bg-accent/10 px-8 text-base font-semibold text-accent shadow-lg shadow-accent/15 transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:bg-accent/15 hover:shadow-accent/25 min-[420px]:w-auto sm:text-lg"
                  >
                    <Sparkles className="h-5 w-5 mr-2 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-12" />
                    {isRTL ? "اكتشف القادم" : "Discover What's Coming"}
                  </Button>
                </Link>
              </div>
            </div>
            </Reveal>
          </div>

          <style jsx global>{`
            @keyframes gradient {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
            @media (prefers-reduced-motion: no-preference) {
              .animate-gradient {
                animation: gradient 8s ease infinite;
              }
            }

            @keyframes floating-float-y {
              0%, 100% { transform: translate3d(0, 0, 0); }
              50% { transform: translate3d(0, -10px, 0); }
            }

            @keyframes floating-drift-right {
              0% { transform: translate3d(0, 0, 0); }
              50% { transform: translate3d(26px, 0, 0); }
              100% { transform: translate3d(0, 0, 0); }
            }

            @keyframes floating-drift-left {
              0% { transform: translate3d(0, 0, 0); }
              50% { transform: translate3d(-26px, 0, 0); }
              100% { transform: translate3d(0, 0, 0); }
            }

            @media (prefers-reduced-motion: no-preference) {
              .floating-float {
                animation-name: floating-float-y;
                animation-timing-function: ease-in-out;
                animation-iteration-count: infinite;
              }
              .floating-drift-right {
                animation-name: floating-drift-right;
                animation-timing-function: ease-in-out;
                animation-iteration-count: infinite;
              }
              .floating-drift-left {
                animation-name: floating-drift-left;
                animation-timing-function: ease-in-out;
                animation-iteration-count: infinite;
              }
            }

            .reviews-marquee {
              position: relative;
              overflow: hidden;
              padding: 2px;
              direction: ltr;
            }

            .reviews-track {
              display: flex;
              align-items: flex-start;
              gap: 12px;
              width: max-content;
              animation: marquee-ltr 32s linear infinite;
              will-change: transform;
            }

            .reviews-marquee:hover .reviews-track {
              animation-play-state: paused;
            }

            .reviews-card {
              width: 260px;
              min-width: 260px;
            }

            @media (min-width: 768px) {
              .reviews-card {
                width: 320px;
                min-width: 320px;
              }
            }

            @keyframes marquee-ltr {
              0% {
                transform: translateX(0);
              }
              100% {
                transform: translateX(-50%);
              }
            }

            .reviews-fade-left,
            .reviews-fade-right {
              position: absolute;
              top: 0;
              bottom: 0;
              width: 60px;
              pointer-events: none;
            }

            .reviews-fade-left {
              left: 0;
              background: linear-gradient(
                to right,
                color-mix(in oklch, var(--background) 80%, transparent),
                transparent
              );
            }

            .reviews-fade-right {
              right: 0;
              background: linear-gradient(
                to left,
                color-mix(in oklch, var(--background) 80%, transparent),
                transparent
              );
            }

            @media (prefers-reduced-motion: reduce) {
              .reviews-track {
                animation: none;
                transform: none;
              }
            }
          `}</style>
        </section>

        <section className="py-16 sm:py-20 lg:py-24 border-b bg-gradient-to-b from-background to-muted/20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-10 sm:mb-12">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent text-balance">
                  {isRTL ? "إنجازاتنا بالأرقام" : "Our Achievements in Numbers"}
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {isRTL ? "انضم لآلاف المتعلمين حول العالم" : "Join thousands of learners worldwide"}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                {[
                  {
                    icon: BookOpen,
                    value: stats.courses,
                    suffix: "+",
                    label: isRTL ? "دورة تعليمية" : "Courses",
                    color: "text-blue-500",
                  },
                  {
                    icon: Users,
                    value: stats.students,
                    suffix: "+",
                    label: isRTL ? "عضو مسجل" : "Registered Members",
                    color: "text-green-500",
                  },
                  {
                    icon: Award,
                    value: stats.certificates,
                    suffix: "+",
                    label: isRTL ? "شهادة صادرة" : "Certificates",
                    color: "text-purple-500",
                  },
                  {
                    icon: Zap,
                    value: stats.satisfaction,
                    suffix: "%",
                    label: isRTL ? "نسبة الرضا" : "Satisfaction",
                    color: "text-amber-500",
                  },
                ].map((stat, i) => (
                  <StatsCard3D
                    key={i}
                    icon={stat.icon}
                    iconClassName={stat.color}
                    label={stat.label}
                    value={
                      <AnimatedCounter
                        key={stat.value}
                        value={stat.value}
                        suffix={stat.suffix}
                        duration={2500}
                        className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent"
                      />
                    }
                  />
                ))}
              </div>
            </div>
            </Reveal>
          </div>
        </section>

        <section className="py-16 sm:py-20 lg:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-14 lg:mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-balance leading-tight">
                {isRTL ? "لماذا نيون؟" : "Why Neon?"}
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg md:text-xl leading-8">
                {isRTL
                  ? "نوفر لك كل ما تحتاجه لتطوير مهاراتك وتحقيق أهدافك المهنية"
                  : "We provide everything you need to develop your skills and achieve your professional goals"}
              </p>
            </div>

            <WhyNeonFlexCards
              features={[
                {
                  title: isRTL ? "محتوى عالي الجودة" : "High-Quality Content",
                  description: isRTL
                    ? "دورات تعليمية من خبراء في مجالاتهم مع محتوى محدث باستمرار"
                    : "Educational courses from field experts with continuously updated content",
                  Icon: BookOpen,
                  color: "text-blue-500",
                },
                {
                  title: isRTL ? "شهادات إتمام" : "Completion Certificates",
                  description: isRTL
                    ? "احصل على شهادات إتمام عند إتمام الدورات لتعزيز سيرتك الذاتية"
                    : "Earn completion certificates upon course completion to enhance your resume",
                  Icon: Award,
                  color: "text-purple-500",
                },
                {
                  title: isRTL ? "تعلم بمرونة" : "Flexible Learning",
                  description: isRTL
                    ? "ادرس في أي وقت ومن أي مكان بما يناسب جدولك اليومي"
                    : "Study anytime, anywhere to fit your daily schedule",
                  Icon: Clock,
                  color: "text-amber-500",
                },
              ]}
            />
          </div>
        </section>

        <section className="py-16 sm:py-20 lg:py-24 border-t border-b">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8" dir={isRTL ? "rtl" : "ltr"}>
            <Reveal>
            <div className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 items-start">
              <div className="space-y-4 lg:pt-4">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  {isRTL ? "الأسئلة الشائعة" : "FAQ"}
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight text-balance">
                  {isRTL ? "إجابات سريعة قبل أن تبدأ" : "Quick Answers Before You Start"}
                </h2>
                <p className="text-muted-foreground text-base sm:text-lg leading-8">
                  {isRTL
                    ? "جمعنا لك أكثر الأسئلة شيوعًا حول NEON: التسجيل، الدورات، الشهادات، والدعم."
                    : "A short list of the most common questions about NEON: signup, courses, certificates, and support."}
                </p>
                <div className="pt-2">
                  <Link href={`/${language}/faq`}>
                    <Button variant="outline" className="rounded-lg border-primary/20 bg-background/70 font-semibold">
                      {isRTL ? "عرض كل الأسئلة" : "View All FAQs"}
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-primary/10 bg-background/65 shadow-sm backdrop-blur-sm">
                <HomeFaqAccordion items={getFaqItems(isRTL ? "ar" : "en").slice(0, 5)} />
              </div>
            </div>
            </Reveal>
          </div>
        </section>

        <section className="relative overflow-hidden py-20 sm:py-24 lg:py-28">
          <GlowBlob className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0" color="primary" size="800px" />
          <HeroSplineGalaxy className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-[360px] w-full -translate-y-1/2 opacity-70 sm:h-[430px] lg:h-[520px]" />

          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl text-center">
              <div className="mx-auto max-w-3xl space-y-6 rounded-2xl bg-background/78 px-4 py-6 shadow-2xl shadow-background/35 backdrop-blur-xl sm:space-y-7 sm:px-8 sm:py-8 lg:px-10">
                <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-balance leading-tight text-foreground drop-shadow-sm">
                  {isRTL ? "جاهز لبدء رحلتك التعليمية؟" : "Ready to Start Your Learning Journey?"}
                </h2>
                <p className="text-base sm:text-lg md:text-xl text-foreground/75 text-balance leading-8 max-w-2xl mx-auto">
                  {isRTL
                    ? "انضم لآلاف الطلاب واكتشف دورات تساعدك على تحقيق أهدافك"
                    : "Join thousands of students and discover courses that help you achieve your goals"}
                </p>
                <Link href={`/${language}/courses`} className="block sm:inline-block">
                  <Button size="lg" className="min-h-12 w-full rounded-lg px-8 text-base font-semibold shadow-lg shadow-primary/15 hover-lift hover-glow sm:w-auto sm:text-lg">
                    <Sparkles className="h-5 w-5 mr-2" />
                    {isRTL ? "تصفح الدورات الآن" : "Browse Courses Now"}
                  </Button>
                </Link>
              </div>

              {reviews.length > 0 && (
                <div className="mt-10 rounded-2xl bg-background/70 p-4 text-start shadow-xl shadow-background/25 backdrop-blur-xl sm:mt-12 sm:p-5" dir={isRTL ? "rtl" : "ltr"}>
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="font-semibold text-base">
                      {isRTL ? "آراء الطلاب" : "Student Reviews"} ({stats.totalReviews})
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isRTL ? "أحدث التقييمات" : "Latest ratings"}
                    </div>
                  </div>

                  <div className="reviews-marquee">
                    <div className="reviews-track">
                      {[...reviews, ...reviews].map((r, idx) => (
                        <Card
                          key={`${r.id}-${idx}`}
                          className="reviews-card border-primary/10 bg-background/70 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-background/85"
                        >
                          <CardContent className="p-4 space-y-3" dir={isRTL ? "rtl" : "ltr"}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-sm truncate">
                                {r.userName || (isRTL ? "طالب" : "Student")}
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={[
                                      "h-3.5 w-3.5",
                                      i < Number((r as any).rating || 0)
                                        ? "text-amber-500 fill-amber-500"
                                        : "text-muted-foreground/40",
                                    ].join(" ")}
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="text-xs text-muted-foreground truncate">
                              {(isRTL ? r.courseTitleAr : r.courseTitleEn) || (isRTL ? "دورة" : "Course")}
                            </div>

                            <div className="text-sm text-muted-foreground leading-relaxed">
                              {r.comment}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <div className="reviews-fade-left" />
                    <div className="reviews-fade-right" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-10 sm:py-12 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:gap-10 md:grid-cols-3">
            <div className="space-y-3">
              <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {isRTL ? "نيون" : "Neon"}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isRTL
                  ? "منصة تعلم إلكتروني تساعدك على تطوير مهاراتك عبر دورات عالية الجودة."
                  : "An e-learning platform to help you grow your skills through high-quality courses."}
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">{isRTL ? "روابط" : "Links"}</div>
              <div className="grid gap-2 text-sm">
                <Link className="text-muted-foreground hover:text-foreground transition-colors" href={`/${language}/about`}>
                  {isRTL ? "من نحن" : "About Us"}
                </Link>
                <Link className="text-muted-foreground hover:text-foreground transition-colors" href={`/${language}/privacy`}>
                  {isRTL ? "سياسة الخصوصية" : "Privacy Policy"}
                </Link>
                <Link className="text-muted-foreground hover:text-foreground transition-colors" href={`/${language}/terms`}>
                  {isRTL ? "شروط الاستخدام" : "Terms of Use"}
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">{isRTL ? "الدعم" : "Support"}</div>
              <div className="grid gap-2 text-sm">
                <Link className="text-muted-foreground hover:text-foreground transition-colors" href={`/${language}/faq`}>
                  {isRTL ? "الأسئلة الشائعة" : "FAQ"}
                </Link>
                <Link className="text-muted-foreground hover:text-foreground transition-colors" href={`/${language}/contact`}>
                  {isRTL ? "تواصل معنا" : "Contact"}
                </Link>
                <Link className="text-muted-foreground hover:text-foreground transition-colors" href={`/${language}/verify`}>
                  {isRTL ? "تحقق" : "Verify"}
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isRTL
                ? "© 2025 Neon | نيون التعليمية. جميع الحقوق محفوظة."
                : "© 2025 Neon Educational Platform. All rights reserved."}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
