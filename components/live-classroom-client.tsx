"use client"

import {
  LiveKitRoom,
  useRoomContext,
  GridLayout,
  TrackLoop,
  VideoTrack,
  useTracks,
  useIsMuted,
  useIsSpeaking,
  useParticipantInfo,
  useTrackRefContext,
  isTrackReference,
  RoomAudioRenderer,
  ControlBar,
} from "@livekit/components-react"
import "@livekit/components-styles"
import { DataPacket_Kind, RoomEvent, Track } from "livekit-client"
import { useEffect, useMemo, useRef, useState } from "react"
import { Hand, Loader2, MicOff, VideoOff, ChevronLeft, ChevronRight, Minimize2, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface UserInfo {
  id: string
  name: string
  role: string
  image?: string
}

function parseAvatarUrl(metadata?: string): string | null {
  if (!metadata) return null
  try {
    const parsed = JSON.parse(metadata)
    return typeof parsed?.avatarUrl === "string" && parsed.avatarUrl ? parsed.avatarUrl : null
  } catch {
    return null
  }
}

function getInitials(name?: string): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function VideoStage({ isAr }: { isAr: boolean }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="min-h-0 flex-1 p-3">
        <GridLayout tracks={tracks} className="h-full">
          <TrackLoop tracks={tracks}>
            <ParticipantVideoTile isAr={isAr} />
          </TrackLoop>
        </GridLayout>
      </div>
      <div className="shrink-0 border-t bg-background/95 px-2 py-1.5">
        <ControlBar variation="minimal" controls={{ chat: false, settings: false }} />
      </div>
      <RoomAudioRenderer />
    </div>
  )
}

function ParticipantVideoTile({ isAr }: { isAr: boolean }) {
  const trackRef = useTrackRefContext()
  const participant = trackRef.participant
  const { name, metadata } = useParticipantInfo({ participant })
  const isSpeaking = useIsSpeaking(participant)
  const isCameraMuted = useIsMuted(trackRef)

  const micPublication = participant.getTrackPublication(Track.Source.Microphone)
  const isMicMuted = !micPublication || micPublication.isMuted

  const isScreenShare = trackRef.source === Track.Source.ScreenShare
  const hasVideo = isTrackReference(trackRef) && !isCameraMuted
  const avatarUrl = parseAvatarUrl(metadata)
  const displayName = name || (isAr ? "مشارك" : "Participant")

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl border bg-muted/40",
        isSpeaking && !isScreenShare && "border-primary ring-2 ring-primary/60"
      )}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className={cn("h-full w-full", isScreenShare ? "object-contain" : "object-cover")}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-20 w-20 rounded-full border-4 border-background object-cover shadow-lg sm:h-24 sm:w-24"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary sm:h-24 sm:w-24 sm:text-2xl">
              {getInitials(name)}
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          "absolute bottom-2 flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm",
          isAr ? "right-2" : "left-2"
        )}
      >
        {isMicMuted && <MicOff className="h-3.5 w-3.5 shrink-0 text-red-400" />}
        <span className="truncate">{displayName}</span>
      </div>
    </div>
  )
}

export default function LiveClassroomClient({
  roomName,
  user,
  isAr,
  mode,
}: {
  roomName: string
  user: UserInfo
  isAr: boolean
  mode?: "student" | "instructor"
}) {
  const [token, setToken] = useState("")
  const [joinError, setJoinError] = useState("")
  const { toast } = useToast()

  const effectiveMode = useMemo(() => {
    if (mode) return mode
    return user.role === "instructor" || user.role === "admin" ? "instructor" : "student"
  }, [mode, user.role])

  useEffect(() => {
    if (!roomName || !user) return

    const controller = new AbortController()
    ;(async () => {
      try {
        const resp = await fetch(
          `/api/livekit?room=${roomName}&username=${encodeURIComponent(user.name || user.id)}`,
          { signal: controller.signal }
        )
        const data = await resp.json()
        if (!resp.ok || !data.token) {
          throw new Error(data?.error || `HTTP ${resp.status}`)
        }
        setToken(data.token)
      } catch (e) {
        if ((e as any)?.name === "AbortError") return
        console.error(e)
        setJoinError((e as Error)?.message || "unknown")
        toast({
          title: isAr ? "خطأ" : "Error",
          description: isAr ? "فشل في الاتصال بالخادم" : "Failed to connect to server",
          variant: "destructive",
        })
      }
    })()

    return () => controller.abort()
  }, [roomName, user, isAr, toast])

  if (joinError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-background text-center">
        <span className="text-sm font-medium text-destructive">
          {isAr ? "تعذّر الانضمام للجلسة" : "Couldn't join the session"}
        </span>
        <span className="text-xs text-muted-foreground">{joinError}</span>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className={cn("ml-2", isAr && "ml-0 mr-2")}>
          {isAr ? "جاري الانضمام..." : "Joining Class..."}
        </span>
      </div>
    )
  }

  const shouldAutoEnableAv = effectiveMode === "instructor"

  return (
    <LiveKitRoom
      video={shouldAutoEnableAv}
      audio={shouldAutoEnableAv}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      style={{ height: "100%" }}
      onDisconnected={() => {
        toast({
          title: isAr ? "انقطع الاتصال" : "Disconnected",
          description: isAr ? "لقد غادرت البث المباشر" : "You have left the live stream",
        })
      }}
    >
      <ClassroomLayout isAr={isAr} user={user} effectiveMode={effectiveMode} />
    </LiveKitRoom>
  )
}

function ClassroomLayout({
  isAr,
  user,
  effectiveMode,
}: {
  isAr: boolean
  user: UserInfo
  effectiveMode: "student" | "instructor"
}) {
  const room = useRoomContext()
  const { toast } = useToast()
  const [raisedHands, setRaisedHands] = useState<string[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<BlobPart[]>([])
  const [isHandRaised, setIsHandRaised] = useState(false)

  const isInstructorView = effectiveMode === "instructor"

  // Initial mute for students
  useEffect(() => {
    if (effectiveMode !== "student") return

    const applyDefaultMute = async () => {
      try {
        await room.localParticipant.setMicrophoneEnabled(false)
      } catch {}
      try {
        await room.localParticipant.setCameraEnabled(false)
      } catch {}
    }

    const onConnected = () => {
      void applyDefaultMute()
    }

    room.on(RoomEvent.Connected, onConnected)
    void applyDefaultMute()

    return () => {
      room.off(RoomEvent.Connected, onConnected)
    }
  }, [room, effectiveMode])

  // Data channel handlers (Raise Hand, Mute All)
  useEffect(() => {
    const handleData = (payload: Uint8Array, participant?: any, _kind?: DataPacket_Kind) => {
      const str = new TextDecoder().decode(payload)
      try {
        const data = JSON.parse(str)

        if (data.type === "RAISE_HAND") {
          const whoName = participant?.name || participant?.identity || "Unknown"
          toast({
            title: isAr ? "رفع اليد" : "Hand Raised",
            description: `${whoName} ${isAr ? "رفع يده" : "raised their hand"}`,
          })
          setRaisedHands((prev) => {
            if (prev.includes(whoName)) return prev
            return [...prev, whoName]
          })
          return
        }

        if (data.type === "LOWER_HAND") {
          const whoName = participant?.name || participant?.identity || "Unknown"
          setRaisedHands((prev) => prev.filter((n) => n !== whoName))
          toast({
            title: isAr ? "خفض اليد" : "Hand Lowered",
            description: `${whoName} ${isAr ? "أنزل يده" : "lowered their hand"}`,
          })
          return
        }

        if (effectiveMode !== "student") return

        if (data.type === "FORCE_MUTE") {
          void room.localParticipant.setMicrophoneEnabled(false)
          toast({
            title: isAr ? "تم كتم المايك" : "Mic muted",
            description: isAr ? "تم إيقاف المايك بواسطة المدرس" : "Instructor muted your microphone",
          })
          return
        }

        if (data.type === "FORCE_CAMERA_OFF") {
          void room.localParticipant.setCameraEnabled(false)
          toast({
            title: isAr ? "تم إيقاف الكاميرا" : "Camera off",
            description: isAr ? "تم إيقاف الكاميرا بواسطة المدرس" : "Instructor turned off your camera",
          })
          return
        }
      } catch {}
    }

    room.on(RoomEvent.DataReceived, handleData)
    return () => {
      room.off(RoomEvent.DataReceived, handleData)
    }
  }, [room, isAr, toast, effectiveMode])

  const toggleRaiseHand = async () => {
    const nextRaised = !isHandRaised
    const data = JSON.stringify({ type: nextRaised ? "RAISE_HAND" : "LOWER_HAND" })
    const encoder = new TextEncoder()
    await room.localParticipant.publishData(encoder.encode(data), {
      reliable: true,
    })
    setIsHandRaised(nextRaised)
    toast({
      title: nextRaised ? (isAr ? "تم رفع اليد" : "Hand Raised") : (isAr ? "تم خفض اليد" : "Hand Lowered"),
      description: nextRaised
        ? (isAr ? "لقد قمت برفع يدك للمدرس" : "You raised your hand to the instructor")
        : (isAr ? "لقد أنزلت يدك" : "You lowered your hand"),
    })
  }

  const broadcast = async (type: "FORCE_MUTE" | "FORCE_CAMERA_OFF") => {
    const data = JSON.stringify({ type })
    const encoder = new TextEncoder()
    await room.localParticipant.publishData(encoder.encode(data), { reliable: true })
  }

  const startRecording = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
      const mimeType = "video/webm"
      const recorder = new MediaRecorder(displayStream, { mimeType })

      recordedChunksRef.current = []
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `live-recording-${new Date().toISOString()}.webm`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        toast({
          title: isAr ? "تم حفظ التسجيل" : "Recording Saved",
          description: isAr ? "تم تنزيل الفيديو على جهازك" : "Video downloaded to your device",
        })
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      toast({
        title: isAr ? "بدأ التسجيل" : "Recording Started",
        description: isAr ? "يتم تسجيل الشاشة والصوت الآن" : "Screen and audio are now recording",
      })
    } catch (e) {
      console.error(e)
      toast({
        title: isAr ? "فشل التسجيل" : "Recording Failed",
        description: isAr
          ? "تأكد من منح صلاحية مشاركة الشاشة والصوت"
          : "Ensure screen/audio capture permission is granted",
        variant: "destructive",
      })
    }
  }

  const stopRecording = () => {
    const r = mediaRecorderRef.current
    if (r && r.state !== "inactive") {
      r.stop()
      setIsRecording(false)
    }
  }

  const handleMuteAll = async () => {
    await broadcast("FORCE_MUTE")
    toast({
      title: isAr ? "تم إرسال أمر الكتم" : "Mute sent",
      description: isAr ? "تم كتم مايكات الطلاب" : "Students' microphones were muted",
    })
  }

  const handleCameraOffAll = async () => {
    await broadcast("FORCE_CAMERA_OFF")
    toast({
      title: isAr ? "تم إرسال أمر إيقاف الكاميرات" : "Camera off sent",
      description: isAr ? "تم إيقاف كاميرات الطلاب" : "Students' cameras were turned off",
    })
  }

  return (
    <div className="relative h-full w-full">
      <VideoStage isAr={isAr} />
      
      {/* Student Controls */}
      {!isInstructorView && (
        <div
          className={cn(
            "absolute top-4 left-4 z-50 flex flex-wrap items-center gap-2",
            isAr && "left-auto right-4"
          )}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleRaiseHand}
            className="shadow-lg bg-background/80 backdrop-blur-sm hover:bg-background"
            aria-pressed={isHandRaised}
          >
            <Hand className={cn("mr-2 h-4 w-4", isHandRaised ? "text-yellow-500" : "text-muted-foreground", isAr && "mr-0 ml-2")} />
            {isAr ? (isHandRaised ? "خفض اليد" : "رفع اليد") : (isHandRaised ? "Lower Hand" : "Raise Hand")}
          </Button>
        </div>
      )}

      {/* Instructor Controls */}
      {isInstructorView && (
        <aside
          className={cn(
            "absolute top-4 right-4 z-50 rounded-lg border bg-background/80 backdrop-blur-sm shadow-lg transition-all duration-300",
            isAr ? "right-auto left-4" : "right-4 left-auto",
            isCollapsed ? "w-12" : "w-64"
          )}
        >
          <div className={cn("p-3 border-b flex items-center justify-between", isCollapsed && "justify-center p-2")}>
            {!isCollapsed && <span className="text-sm font-semibold">{isAr ? "تحكم البث" : "Live Controls"}</span>}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                 isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
              ) : (
                 isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {!isCollapsed && (
            <>
              <div className="p-3 space-y-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleMuteAll}
                >
                  <MicOff className={cn("mr-2 h-4 w-4", isAr && "mr-0 ml-2")} />
                  {isAr ? "كتم الطلاب" : "Mute Students"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleCameraOffAll}
                >
                  <VideoOff className={cn("mr-2 h-4 w-4", isAr && "mr-0 ml-2")} />
                  {isAr ? "إيقاف الكاميرات" : "Stop Cameras"}
                </Button>
                <Button
                  variant={isRecording ? "destructive" : "secondary"}
                  size="sm"
                  className="w-full justify-start"
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  <div
                    className={cn(
                      "mr-2 h-3 w-3 rounded-full",
                      isAr && "mr-0 ml-2",
                      isRecording ? "bg-red-600 animate-pulse" : "bg-green-600"
                    )}
                  />
                  {isRecording ? (isAr ? "إيقاف التسجيل" : "Stop Recording") : (isAr ? "بدء التسجيل" : "Start Recording")}
                </Button>
              </div>
              {raisedHands.length > 0 && (
                <div className="p-3 border-t text-xs text-muted-foreground">
                  <div className="font-medium mb-1">
                    {isAr ? "أيدي مرفوعة:" : "Raised Hands:"}
                  </div>
                  <div className="space-y-1">
                    {raisedHands.map((n) => (
                      <div key={n} className="truncate">{n}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      )}
    </div>
  )
}
