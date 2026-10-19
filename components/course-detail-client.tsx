"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { t } from "@/lib/i18n"
import { Clock, BookOpen, Share2, PlayCircle, Lock, Star, ChevronRight, ShoppingCart } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

import { enrollAction, addToCartAction, checkoutAction } from "@/lib/actions"

import { BookmarkButton } from "@/components/bookmark-button"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, Play, FileText, HelpCircle } from "lucide-react"

export function CourseDetailClient({ course, initialBookmarked, initialEnrolled = false }: { course: any, initialBookmarked: boolean, initialEnrolled?: boolean }) {
  const router = useRouter()
  const { language } = useLanguage()
  const { user } = useAuth()
  const { toast } = useToast()
  const [isEnrolled, setIsEnrolled] = useState(initialEnrolled)
  const [loading, setLoading] = useState(false)
  const [addingToCart, setAddingToCart] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Helper to safely access properties that might be camelCase or snake_case
  const getProp = (obj: any, camel: string, snake: string) => {
    if (!obj) return undefined
    return obj[camel] !== undefined ? obj[camel] : obj[snake]
  }

  const title = language === "ar" ? getProp(course, "titleAr", "title_ar") : getProp(course, "titleEn", "title_en")
  const description = language === "ar" ? getProp(course, "descriptionAr", "description_ar") : getProp(course, "descriptionEn", "description_en")
  const subtitle = language === "ar" ? getProp(course, "subtitleAr", "subtitle_ar") : getProp(course, "subtitleEn", "subtitle_en")
  const learningOutcomes = getProp(course, "learningOutcomes", "learning_outcomes") || []
  const requirements = getProp(course, "requirements", "requirements") || []
  const modules = getProp(course, "modules", "modules") || []
  const lessons = getProp(course, "lessons", "lessons") || []
  const duration = getProp(course, "duration", "duration") || 0
  const rating = getProp(course, "rating", "rating")
  const level = getProp(course, "difficulty", "difficulty")
  const instructor = getProp(course, "instructor", "instructor")
  const instructorName = instructor?.name || getProp(course, "instructorName", "instructor_name")
  const instructorAvatar = instructor?.avatarUrl || getProp(course, "instructorAvatar", "instructor_avatar")
  const thumbnailUrl = getProp(course, "thumbnailUrl", "thumbnail_url")
  const videoUrl = getProp(course, "videoUrl", "video_url") || getProp(course, "previewVideoUrl", "preview_video_url")
  const isFree = getProp(course, "isFree", "is_free")
  const price = getProp(course, "price", "price")

  const getEmbedUrl = (url: string) => {
    if (!url) return null
    
    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    const youtubeMatch = url.match(youtubeRegex)
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`
    }
    
    // Vimeo
    const vimeoRegex = /(?:vimeo\.com\/)([0-9]+)/
    const vimeoMatch = url.match(vimeoRegex)
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    }
    
    return url
  }

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    toast({
      title: t("copiedToClipboard", language),
      description: url,
    })
  }

  const handleAddToCart = async () => {
    if (!user) {
      router.push(`/${language}/auth/login`)
      return
    }

    setAddingToCart(true)
    try {
      const result = await addToCartAction(course.id)
      
      if (result.success) {
        toast({
          title: language === "ar" ? "تمت الإضافة" : "Added",
          description: language === "ar" ? "تمت إضافة الدورة للسلة" : "Course added to cart",
        })
        router.refresh()
      } else {
        toast({
          title: language === "ar" ? "ملاحظة" : "Note",
          description: result.message || "Already in cart",
        })
      }
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "حدث خطأ غير متوقع" : "An unexpected error occurred",
      })
    } finally {
      setAddingToCart(false)
    }
  }

  const handleEnroll = async () => {
    if (!user) {
      router.push(`/${language}/auth/login`)
      return
    }

    setLoading(true)
    try {
      const result = await enrollAction(course.id)
      
      if (result.error) {
        toast({
          variant: "destructive",
          title: language === "ar" ? "خطأ" : "Error",
          description:
            result.error === "Paid course requires checkout"
              ? language === "ar"
                ? "هذه دورة مدفوعة. استخدم شراء الآن لإتمام الدفع."
                : "This is a paid course. Use Buy Now to checkout."
              : language === "ar"
                ? "فشل التسجيل في الدورة"
                : "Failed to enroll",
        })
      } else {
        setIsEnrolled(true)
        toast({
          title: t("enrolled", language),
          description: language === "ar" ? "تم التسجيل بنجاح، جاري التوجيه..." : "Successfully enrolled, redirecting...",
        })
        router.refresh()
        router.push(`/${language}/student/dashboard`)
      }
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "حدث خطأ غير متوقع" : "An unexpected error occurred",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBuyNow = async () => {
    if (!user) {
      router.push(`/${language}/auth/login`)
      return
    }

    setLoading(true)
    try {
      const add = await addToCartAction(course.id)
      if (!add.success) {
        toast({
          variant: "destructive",
          title: language === "ar" ? "خطأ" : "Error",
          description: add.error || add.message || "Failed",
        })
        return
      }

      const checkout = await checkoutAction(undefined, undefined, language)
      if (checkout?.checkoutUrl) {
        window.location.href = checkout.checkoutUrl
        return
      }
      if (checkout?.success) {
        router.refresh()
        router.push(`/${language}/student/dashboard`)
        return
      }

      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description: checkout?.error || "Checkout failed",
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description: e instanceof Error ? e.message : "Failed",
      })
    } finally {
      setLoading(false)
    }
  }

  // Format duration from minutes to hours and minutes
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}min`
    }
    return `${mins}min`
  }

  return (
    <main className="relative min-h-screen pb-20">
      {/* Background Effect */}
      <div className="fixed inset-0 pointer-events-none starfield-light">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
      </div>

      {/* Breadcrumb */}
      <div className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href={`/${language}/courses`}>{t("courses", language)}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold">{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: Course Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header Mobile Only (visible on small screens) */}
            <div className="lg:hidden space-y-4">
              <h1 className="text-3xl font-bold text-balance">{title}</h1>
              <p className="text-muted-foreground text-lg">{subtitle}</p>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="secondary" className="gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {lessons.length} {t("lessons", language)}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(duration)}
                </Badge>
                {rating && (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {rating}
                  </Badge>
                )}
              </div>
            </div>

            {/* Video Player / Thumbnail */}
            <div className="rounded-xl overflow-hidden border bg-card shadow-sm aspect-video relative group">
              {!isPlaying ? (
                <div 
                  className={`w-full h-full relative ${videoUrl ? "cursor-pointer" : ""}`}
                  onClick={() => { if (videoUrl) setIsPlaying(true) }}
                >
                  {thumbnailUrl ? (
                    <Image
                      src={thumbnailUrl}
                      alt={title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <PlayCircle className="w-16 h-16 text-muted-foreground/50" />
                    </div>
                  )}
                  {videoUrl && (
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-background/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 ml-1 text-primary fill-current" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full bg-black">
                  {videoUrl && (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be") || videoUrl.includes("vimeo.com")) ? (
                    <iframe
                      src={getEmbedUrl(videoUrl) || ""}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={videoUrl}
                      className="w-full h-full"
                      controls
                      autoPlay
                    />
                  )}
                </div>
              )}
            </div>

            {/* Tabs for Content */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-muted/50">
                <TabsTrigger value="overview" className="px-6 py-2.5">{language === "ar" ? "نظرة عامة" : "Overview"}</TabsTrigger>
                <TabsTrigger value="curriculum" className="px-6 py-2.5">{language === "ar" ? "المنهج" : "Curriculum"}</TabsTrigger>
                <TabsTrigger value="instructor" className="px-6 py-2.5">{t("instructor", language)}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-8 mt-6">
                 {/* Description */}
                <div className="prose dark:prose-invert max-w-none">
                   <h3 className="text-xl font-bold mb-4">{t("description", language)}</h3>
                   <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{description}</p>
                </div>

                {/* What You Will Learn */}
                {learningOutcomes && learningOutcomes.length > 0 && (
                  <div className="border rounded-xl p-6 bg-card/50">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      {language === "ar" ? "ماذا ستتعلم" : "What you'll learn"}
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {learningOutcomes.map((item: string, i: number) => (
                        <div key={i} className="flex gap-2 items-start">
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-1 shrink-0" />
                          <span className="text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Requirements */}
                {requirements && requirements.length > 0 && (
                  <div className="border rounded-xl p-6 bg-card/50">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-blue-500" />
                      {language === "ar" ? "المتطلبات" : "Requirements"}
                    </h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      {requirements.map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="curriculum" className="mt-6">
                <div className="border rounded-xl overflow-hidden bg-card">
                  <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                    <h3 className="font-semibold">{language === "ar" ? "محتوى الدورة" : "Course Content"}</h3>
                    <div className="text-sm text-muted-foreground">
                       {modules.length > 0 ? `${modules.length} ${language === "ar" ? "وحدات" : "modules"}` : ""} • {lessons.length} {t("lessons", language)}
                    </div>
                  </div>
                  
                  {modules.length > 0 ? (
                    <Accordion type="multiple" defaultValue={modules.map((m: any) => m.id)} className="w-full">
                      {modules.map((module: any, index: number) => (
                        <AccordionItem key={module.id} value={module.id} className="border-b last:border-0">
                          <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/50">
                            <div className="text-start">
                              <div className="font-medium">{language === "ar" ? getProp(module, "titleAr", "title_ar") : getProp(module, "titleEn", "title_en")}</div>
                              <div className="text-xs text-muted-foreground font-normal mt-1">
                                {module.lessons?.length || 0} {t("lessons", language)}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-0 pb-0">
                            <div className="divide-y">
                              {module.lessons?.map((lesson: any) => (
                                <div key={lesson.id} className="flex items-center justify-between p-3 pl-8 hover:bg-muted/30 transition-colors">
                                  <div className="flex items-center gap-3">
                                    {lesson.type === 'video' ? <PlayCircle className="w-4 h-4 text-muted-foreground" /> : <FileText className="w-4 h-4 text-muted-foreground" />}
                                    <span className="text-sm">{language === "ar" ? getProp(lesson, "titleAr", "title_ar") : getProp(lesson, "titleEn", "title_en")}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {(lesson.isFree || lesson.is_free) ? <Badge variant="secondary" className="text-[10px]">{language === "ar" ? "معاينة" : "Preview"}</Badge> : (
                                        !isEnrolled && <Lock className="w-3 h-3 text-muted-foreground" />
                                    )}
                                    <span className="text-xs text-muted-foreground">{lesson.duration ? formatDuration(lesson.duration) : ""}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : (
                    <div className="divide-y">
                      {lessons.map((lesson: any) => (
                        <div key={lesson.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                          <div className="flex items-center gap-3">
                            <PlayCircle className="w-4 h-4 text-primary" />
                            <span className="font-medium">{language === "ar" ? getProp(lesson, "titleAr", "title_ar") : getProp(lesson, "titleEn", "title_en")}</span>
                          </div>
                           <div className="flex items-center gap-3">
                              {(lesson.isFree || lesson.is_free) ? <Badge variant="secondary" className="text-[10px]">{language === "ar" ? "معاينة" : "Preview"}</Badge> : (
                                  !isEnrolled && <Lock className="w-3 h-3 text-muted-foreground" />
                              )}
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="instructor" className="mt-6">
                 <Card>
                    <CardContent className="p-6">
                       <div className="flex items-start gap-4">
                          <Avatar className="w-16 h-16 border-2 border-primary/10">
                             <AvatarImage src={instructorAvatar} />
                             <AvatarFallback>{instructorName?.[0]}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-2">
                             <h3 className="text-xl font-bold">{instructorName}</h3>
                             <p className="text-muted-foreground text-sm">{instructor?.headline}</p>
                             <p className="text-sm leading-relaxed mt-4">
                                {instructor?.bio || "No bio available."}
                             </p>
                          </div>
                       </div>
                    </CardContent>
                 </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column: Sidebar (Sticky) */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Desktop Header Info */}
              <div className="hidden lg:block space-y-4 mb-6">
                 <h1 className="text-3xl font-bold leading-tight">{title}</h1>
                 <p className="text-muted-foreground">{subtitle}</p>
                 <div className="flex flex-wrap gap-2 text-sm">
                    {rating && (
                       <div className="flex items-center text-yellow-500 font-medium">
                          <Star className="w-4 h-4 fill-current mr-1" />
                          {rating}
                       </div>
                    )}
                    <div className="flex items-center text-muted-foreground">
                       <Clock className="w-4 h-4 mr-1" />
                       {formatDuration(duration)}
                    </div>
                    <div className="flex items-center text-muted-foreground">
                       <BookOpen className="w-4 h-4 mr-1" />
                       {lessons.length} {t("lessons", language)}
                    </div>
                 </div>
              </div>

              {/* Action Card */}
              <Card className="border-primary/20 shadow-lg overflow-hidden">
                <CardContent className="p-6 space-y-6">
                   <div className="flex items-baseline gap-2">
                      {isFree ? (
                         <span className="text-3xl font-bold text-green-600">{language === "ar" ? "مجاني" : "Free"}</span>
                      ) : (
                         <div className="space-y-1">
                            <span className="text-3xl font-bold">
                              {price} {language === "ar" ? "ر.س" : "SAR"}
                            </span>
                         </div>
                      )}
                   </div>

                   <div className="space-y-3">
                      {isEnrolled ? (
                         <Button className="w-full text-lg h-12" asChild>
                            <Link href={`/${language}/student/dashboard`}>
                               {language === "ar" ? "اذهب للوحة التحكم" : "Go to Dashboard"}
                            </Link>
                         </Button>
                      ) : (
                        <>
                           {isFree ? (
                              <Button className="w-full text-lg h-12" onClick={handleEnroll} disabled={loading}>
                                 {loading ? (language === "ar" ? "جاري التسجيل..." : "Enrolling...") : (language === "ar" ? "سجل الآن مجاناً" : "Enroll for Free")}
                              </Button>
                           ) : (
                              <div className="space-y-2">
                                 <Button className="w-full text-lg h-12" onClick={handleAddToCart} disabled={addingToCart}>
                                    {addingToCart ? (language === "ar" ? "جاري الإضافة..." : "Adding...") : (language === "ar" ? "أضف للسلة" : "Add to Cart")}
                                 </Button>
                                 <Button variant="outline" className="w-full" onClick={handleBuyNow} disabled={loading}>
                                    {language === "ar" ? "شراء الآن" : "Buy Now"}
                                 </Button>
                              </div>
                           )}
                        </>
                      )}
                      <p className="text-xs text-center text-muted-foreground">
                         {language === "ar" ? "ضمان استرداد الأموال لمدة 30 يومًا" : "30-Day Money-Back Guarantee"}
                      </p>
                   </div>

                   <div className="space-y-3 pt-4 border-t">
                      <h4 className="font-semibold text-sm">{language === "ar" ? "تحتوي هذه الدورة على:" : "This course includes:"}</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                         <li className="flex items-center gap-2">
                            <PlayCircle className="w-4 h-4" /> {formatDuration(duration)} {language === "ar" ? "فيديو عند الطلب" : "on-demand video"}
                         </li>
                         <li className="flex items-center gap-2">
                            <FileText className="w-4 h-4" /> {lessons.length} {language === "ar" ? "درس" : "lessons"}
                         </li>
                         <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> {language === "ar" ? "وصول مدى الحياة" : "Full lifetime access"}
                         </li>
                      </ul>
                   </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

    </main>
  )
}
