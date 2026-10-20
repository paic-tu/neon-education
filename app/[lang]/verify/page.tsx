import { db } from "@/lib/db"
import { certificates } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { CertificatePreview } from "@/components/certificate/certificate-preview"
import { CertificateDownloadButton } from "@/components/certificate/certificate-download-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, Search, ShieldCheck, Sparkles, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { redirect } from "next/navigation"
import { NavBar } from "@/components/nav-bar"

export default async function VerifyPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ lang: string }>
  searchParams: Promise<{ cert?: string }> 
}) {
  const { lang } = await params
  const { cert } = await searchParams
  const isAr = lang === "ar"

  // If no certificate number provided, show search form
  if (!cert) {
    return (
      <div className="relative z-10 min-h-screen flex flex-col text-foreground">
        <NavBar />
        <main className="flex-1 container mx-auto px-4 pt-24 pb-12 sm:pt-28 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="bg-background/70 backdrop-blur-sm border border-border/60 p-8 rounded-full mb-6 shadow-lg shadow-background/10">
            <ShieldCheck className="w-16 h-16 text-primary" />
          </div>
          
          <h1 className="text-3xl font-bold mb-4 text-foreground">
            {isAr ? "التحقق من الشهادة" : "Certificate Verification"}
          </h1>
          
          <p className="text-foreground/75 max-w-md mb-8">
            {isAr 
              ? "أدخل رقم الشهادة للتحقق من صحتها وتفاصيلها" 
              : "Enter the certificate number to verify its validity and details"}
          </p>
          
          <form 
            action={async (formData: FormData) => {
              "use server"
              const certNum = formData.get("cert")?.toString()
              if (certNum) {
                redirect(`/${lang}/verify?cert=${certNum}`)
              }
            }}
            className="flex w-full max-w-sm items-center space-x-2 space-x-reverse"
          >
            <Input 
              type="text" 
              name="cert" 
              placeholder={isAr ? "رقم الشهادة (مثال: NEON-XXXX)" : "Certificate Number (e.g. NEON-XXXX)"}
              className={isAr ? "ml-2" : "mr-2"}
              required
            />
            <Button type="submit">
              {isAr ? "تحقق" : "Verify"}
            </Button>
          </form>
        </main>
        
        <footer className="border-t py-12 bg-background/40 backdrop-blur-sm">
          <div className="container mx-auto px-4">
            <div className="text-center space-y-4">
              <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {isAr ? "منصة نيون التعليمية" : "Neon Learning Platform"}
              </div>
              <p className="text-sm text-foreground/70">
                {isAr
                  ? "© 2025 منصة نيون التعليمية. جميع الحقوق محفوظة."
                  : "© 2025 Neon Learning Platform. All rights reserved."}
              </p>
            </div>
          </div>
        </footer>
      </div>
    )
  }

  // Query certificate
  const certificate = await db.query.certificates.findFirst({
    where: eq(certificates.certificateNumber, cert),
    with: {
      user: true,
      course: {
        with: {
          instructor: true
        }
      }
    }
  })

  // Prepare certificate object for Preview component
  // It expects an array of certificates with specific fields
  const previewCert = certificate ? {
    id: certificate.id,
    title_en: certificate.titleEn,
    title_ar: certificate.titleAr,
    course_title_en: certificate.course?.titleEn,
    course_title_ar: certificate.course?.titleAr,
    certificate_number: certificate.certificateNumber
  } : null

  return (
    <div className="relative z-10 min-h-screen flex flex-col text-foreground">
      <NavBar />
      
      <main className="flex-1 container mx-auto px-4 pt-24 pb-10 sm:pt-28 space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <h1 className="text-3xl font-bold text-foreground">
            {isAr ? "نتيجة التحقق" : "Verification Result"}
          </h1>
          <p className="text-foreground/75">
            {isAr ? `رقم الشهادة: ${cert}` : `Certificate Number: ${cert}`}
          </p>
        </div>

        {certificate ? (
          <div className="space-y-12">
            <div className="grid gap-8 lg:grid-cols-3 max-w-6xl mx-auto">
              {/* Status Card */}
              <Card className="lg:col-span-1 h-fit">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto bg-green-100 dark:bg-green-900/20 p-4 rounded-full mb-4">
                    <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-500" />
                  </div>
                  <CardTitle className="text-green-600 dark:text-green-500">
                    {isAr ? "شهادة موثقة" : "Valid Certificate"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{isAr ? "الطالب" : "Student"}</p>
                    <p className="font-medium text-lg">{certificate.user.name}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{isAr ? "الدورة" : "Course"}</p>
                    <p className="font-medium">{isAr ? certificate.course?.titleAr : certificate.course?.titleEn}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{isAr ? "تاريخ الإصدار" : "Issued On"}</p>
                    <p className="font-medium">
                      {new Date(certificate.issuedAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{isAr ? "الحالة" : "Status"}</p>
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      {isAr ? "نشطة" : "Active"}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <CertificateDownloadButton
                      studentName={certificate.user.name || ""}
                      courseName={isAr ? (certificate.course?.titleAr || "") : (certificate.course?.titleEn || "")}
                      instructorName={certificate.course?.instructor?.name || "Instructor"}
                      completionDate={new Date(certificate.issuedAt).toISOString()}
                      courseId={certificate.courseId || ""}
                      certificateNumber={certificate.certificateNumber}
                      className="w-full"
                      skipRatingCheck={true}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Preview */}
              <div className="lg:col-span-2">
                {previewCert && certificate && (
                  <CertificatePreview 
                    studentName={certificate.user.name || ""}
                    certificates={[previewCert]}
                  />
                )}
              </div>
            </div>

            {/* CTA Section */}
            <div className="bg-background/70 backdrop-blur-sm rounded-2xl p-8 md:p-12 text-center max-w-4xl mx-auto border border-border/60 shadow-xl shadow-background/10">
              <div className="flex justify-center mb-6">
                <div className="bg-primary/10 p-4 rounded-full border border-primary/10">
                  <BookOpen className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                {isAr ? "ابدأ رحلتك التعليمية اليوم" : "Start Your Learning Journey Today"}
              </h2>
              <p className="text-foreground/75 max-w-2xl mx-auto mb-8 text-lg">
                {isAr 
                  ? "انضم إلينا واستكشف مجموعة واسعة من الدورات التدريبية لتطوير مهاراتك والحصول على شهادات معتمدة."
                  : "Join us and explore a wide range of courses to develop your skills and earn certified certificates."}
              </p>
              <Button asChild size="lg" className="font-semibold text-lg px-8 hover-lift">
                <Link href={`/${lang}/courses`}>
                  <Sparkles className="h-5 w-5 mr-2" />
                  {isAr ? "تصفح الدورات" : "Browse Courses"}
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center space-y-8">
            <Card className="border-red-200 bg-card/95 text-card-foreground shadow-xl shadow-background/10 backdrop-blur-sm dark:border-red-900">
              <CardContent className="pt-6 pb-6">
                <div className="mx-auto bg-red-100 dark:bg-red-900/20 p-4 rounded-full mb-4 w-fit">
                  <XCircle className="w-12 h-12 text-red-600 dark:text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-red-600 dark:text-red-500 mb-2">
                  {isAr ? "شهادة غير موجودة" : "Certificate Not Found"}
                </h2>
                <p className="text-foreground/75 mb-6">
                  {isAr 
                    ? `لم يتم العثور على شهادة برقم "${cert}". يرجى التأكد من الرقم والمحاولة مرة أخرى.` 
                    : `No certificate found with number "${cert}". Please check the number and try again.`}
                </p>
                
                <Button asChild variant="outline">
                  <Link href={`/${lang}/verify`}>
                    {isAr ? "بحث جديد" : "New Search"}
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <div className="bg-background/70 backdrop-blur-sm rounded-xl p-6 border border-dashed border-border/60 shadow-lg shadow-background/10">
              <h3 className="font-semibold mb-2">
                {isAr ? "هل تبحث عن دورات؟" : "Looking for courses?"}
              </h3>
              <p className="text-sm text-foreground/70 mb-4">
                {isAr 
                  ? "تصفح كتالوج الدورات لدينا وابدأ التعلم اليوم."
                  : "Browse our course catalog and start learning today."}
              </p>
              <Button asChild variant="link" className="text-primary">
                <Link href={`/${lang}/courses`}>
                  {isAr ? "الذهاب إلى الدورات" : "Go to Courses"} &rarr;
                </Link>
              </Button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t py-12 bg-background/40 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4">
            <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {isAr ? "منصة نيون التعليمية" : "Neon Learning Platform"}
            </div>
            <p className="text-sm text-foreground/70">
              {isAr
                ? "© 2025 منصة نيون التعليمية. جميع الحقوق محفوظة."
                : "© 2025 Neon Learning Platform. All rights reserved."}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}