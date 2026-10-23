"use client"

import { useState } from "react"
import LiveClassroomClient, { useLiveSession } from "@/components/live-classroom-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Video, Loader2, PhoneOff } from "lucide-react"

interface CourseLiveSessionProps {
  courseId: string
  isAr: boolean
  user: { id: string; name: string; role: string }
  initialIsStreaming: boolean
}

export function CourseLiveSession({ courseId, isAr, user, initialIsStreaming }: CourseLiveSessionProps) {
  const { toast } = useToast()
  const { stop } = useLiveSession()
  const [isStreaming, setIsStreaming] = useState(initialIsStreaming)
  const [isUpdating, setIsUpdating] = useState(false)

  async function setStreamingStatus(value: boolean) {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/courses/${courseId}/live-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStreaming: value }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      setIsStreaming(value)
      if (!value) stop()
    } catch {
      toast({
        title: isAr ? "خطأ" : "Error",
        description: isAr ? "فشل تحديث حالة الجلسة" : "Failed to update session status",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  if (!isStreaming) {
    return (
      <Card className="max-w-md mx-auto mt-16">
        <CardHeader>
          <CardTitle>{isAr ? "الجلسات المباشرة" : "Live Sessions"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
          <Video className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "لا توجد جلسة مباشرة حالياً لهذه الدورة."
              : "There is no active live session for this course right now."}
          </p>
          <Button size="lg" className="w-full" onClick={() => setStreamingStatus(true)} disabled={isUpdating}>
            {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Video className="h-4 w-4 mr-2" />}
            {isAr ? "بدء الجلسة" : "Start Session"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const roomName = `course-${courseId}`

  return (
    <div className="relative -m-8 h-[100svh] sm:h-screen">
      <div className={cn("absolute top-4 z-50", isAr ? "right-4" : "left-4")}>
        <Button variant="destructive" size="sm" onClick={() => setStreamingStatus(false)} disabled={isUpdating}>
          {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PhoneOff className="h-4 w-4 mr-2" />}
          {isAr ? "إنهاء الجلسة" : "End Session"}
        </Button>
      </div>

      <LiveClassroomClient roomName={roomName} user={user} isAr={isAr} mode="instructor" />
    </div>
  )
}
