"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Star, Users, Play, X } from "lucide-react"
import { BookmarkButton } from "@/components/bookmark-button"
import { t } from "@/lib/i18n"
import { useLanguage } from "@/lib/language-context"

interface CourseCardProps {
  course: any
  hideBookmark?: boolean
  isPreview?: boolean
}

export function CourseCard({ course, hideBookmark = false, isPreview = false }: CourseCardProps) {
  const { language } = useLanguage()
  const isAr = language === "ar"
  const [isPlaying, setIsPlaying] = useState(false)

  const title = isAr ? (course.title_ar || course.titleAr) : (course.title_en || course.titleEn)
  const categoryName = isAr ? (course.category_name_ar || course.categoryNameAr) : (course.category_name_en || course.categoryNameEn)
  const difficulty = course.difficulty || "beginner"
  const duration = course.duration || 0
  const instructorName = course.instructor_name || course.instructorName || ""
  const rating = course.rating
  const price = course.price
  const isFree = course.is_free || course.isFree || price === 0
  const enrollmentCount = course.enrollment_count || course.enrollmentCount || 0
  const thumbnailUrl = course.thumbnail_url || course.thumbnailUrl || "/placeholder.svg?height=200&width=300&query=course"
  const videoUrl = course.video_url || course.videoUrl || course.preview_video_url || course.previewVideoUrl
  const courseId = course.id
  const isLive = course.isLive || course.is_live || false
  const isStreaming = course.isStreaming || course.is_streaming || false

  const courseLink = isPreview ? "#" : `/${language}/student/course/${courseId}`

  const getEmbedUrl = (url: string) => {
    if (!url) return null
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const videoId = url.includes("v=") ? url.split("v=")[1].split("&")[0] : url.split("/").pop()
      return `https://www.youtube.com/embed/${videoId}`
    }
    if (url.includes("vimeo.com")) {
      const videoId = url.split("/").pop()
      return `https://player.vimeo.com/video/${videoId}`
    }
    return url
  }

  return (
    <Card className="flex flex-col hover:shadow-lg transition-shadow group relative overflow-hidden h-full bg-card">
      <CardHeader className="p-0">
        <div className="relative h-48 w-full bg-muted rounded-t-lg overflow-hidden">
          <div className="absolute top-2 left-2 z-10">
            {isStreaming ? (
              <Badge variant="destructive" className="animate-pulse shadow-md">
                {isAr ? "بث مباشر الآن" : "LIVE NOW"}
              </Badge>
            ) : isLive ? (
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-none shadow-md">
                {isAr ? "دورة لايف" : "Live Course"}
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-black/50 text-white hover:bg-black/70 border-none backdrop-blur-sm shadow-md">
                {isAr ? "مسجلة" : "Recorded"}
              </Badge>
            )}
          </div>
          {isPlaying && videoUrl ? (
            <div className="w-full h-full bg-black relative z-20">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-30 text-white bg-black/50 hover:bg-black/70 rounded-full h-8 w-8"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsPlaying(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
              
              {videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be") || videoUrl.includes("vimeo.com") ? (
                <iframe
                  src={getEmbedUrl(videoUrl) || ""}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={videoUrl}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                  onEnded={() => setIsPlaying(false)}
                />
              )}
            </div>
          ) : (
            <>
              <Image
                src={thumbnailUrl}
                alt={title || "Course"}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                unoptimized
              />
              {videoUrl && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 z-10 pointer-events-none group-hover:pointer-events-auto">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="rounded-full h-12 w-12 bg-white/90 hover:bg-white hover:scale-110 transition-transform shadow-lg"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsPlaying(true)
                    }}
                  >
                    <Play className="h-6 w-6 text-primary fill-current ml-1" />
                  </Button>
                </div>
              )}
              {!hideBookmark && !isPlaying && (
                <div className="absolute top-2 right-2 z-10">
                  <BookmarkButton 
                    courseId={courseId} 
                    initialBookmarked={course.is_bookmarked || false}
                    variant="secondary"
                    size="icon"
                    className="bg-background/80 backdrop-blur-sm hover:bg-background"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {categoryName || (isAr ? "غير مصنف" : "Uncategorized")}
            </Badge>
            <Badge variant="outline">{t(difficulty, language)}</Badge>
          </div>
        </div>
        
        <h3 className="font-semibold text-lg mb-2 line-clamp-2 hover:text-primary transition-colors">
          <Link href={courseLink} onClick={isPreview ? (e) => e.preventDefault() : undefined}>
            {title || (isAr ? "عنوان الدورة" : "Course Title")}
          </Link>
        </h3>
        
        <p className="text-sm text-muted-foreground mb-3">{instructorName}</p>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>
              {Math.floor(duration / 60)} {t("hours", language)}
            </span>
          </div>
          {rating && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>{rating}</span>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="font-bold text-lg text-primary">
            {isFree
              ? t("free", language)
              : `${price} ${isAr ? "ر.س" : "SAR"}`}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{enrollmentCount} {isAr ? "طالب" : "Students"}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button className="w-full" asChild>
          <Link href={courseLink} onClick={isPreview ? (e) => e.preventDefault() : undefined}>
            {isAr ? "عرض التفاصيل" : "View Details"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
