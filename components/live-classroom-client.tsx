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
  useChat,
  type ReceivedChatMessage,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react"
import "@livekit/components-styles"
import { DataPacket_Kind, RoomEvent, Track } from "livekit-client"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import {
  Hand,
  Loader2,
  MicOff,
  VideoOff,
  Video,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  MessageSquare,
  Send,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface UserInfo {
  id: string
  name: string
  role: string
  image?: string
}

interface LiveSessionConfig {
  roomName: string
  user: UserInfo
  isAr: boolean
  mode?: "student" | "instructor"
  href: string
}

interface LiveSessionApi {
  config: LiveSessionConfig | null
  expanded: boolean
  start: (config: LiveSessionConfig) => void
  stop: () => void
  /** Registers the DOM slot on the live page (null when the page unmounts). */
  setPageTarget: (el: HTMLElement | null) => void
  /** Collapses to the floating mini player while staying connected. */
  minimize: () => void
  /** Brings the room back to full size on the live page. */
  expand: () => void
}

const LiveSessionContext = createContext<LiveSessionApi | null>(null)

export function useLiveSession(): LiveSessionApi {
  const ctx = useContext(LiveSessionContext)
  if (!ctx) {
    throw new Error("useLiveSession must be used within a LiveSessionProvider")
  }
  return ctx
}

/**
 * Owns a single LiveKit connection for the whole portal so that navigating
 * between pages never drops the call. The room itself lives in a detached
 * container that is physically moved between the live page (inline) and the
 * document body (floating mini player). Because the container node identity
 * never changes, React never remounts the room and the connection survives.
 */
export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LiveSessionConfig | null>(null)
  const [pageTarget, setPageTargetState] = useState<HTMLElement | null>(null)
  const [floating, setFloating] = useState(false)

  const start = useCallback((next: LiveSessionConfig) => {
    setFloating(false)
    setConfig((prev) => {
      if (
        prev &&
        prev.roomName === next.roomName &&
        prev.user.id === next.user.id &&
        prev.user.name === next.user.name &&
        prev.user.role === next.user.role &&
        prev.isAr === next.isAr &&
        prev.mode === next.mode &&
        prev.href === next.href
      ) {
        return prev
      }
      return next
    })
  }, [])

  const stop = useCallback(() => {
    setFloating(false)
    setPageTargetState(null)
    setConfig(null)
  }, [])

  const setPageTarget = useCallback((el: HTMLElement | null) => {
    // Returning to the live page always restores the full-size view.
    if (el) setFloating(false)
    setPageTargetState(el)
  }, [])

  const minimize = useCallback(() => setFloating(true), [])
  const expand = useCallback(() => setFloating(false), [])

  const expanded = Boolean(pageTarget) && !floating

  const api = useMemo(
    () => ({ config, expanded, start, stop, setPageTarget, minimize, expand }),
    [config, expanded, start, stop, setPageTarget, minimize, expand]
  )

  return (
    <LiveSessionContext.Provider value={api}>
      {children}
      {config && (
        <LiveSessionHost
          config={config}
          inlineTarget={expanded ? pageTarget : null}
          onClose={stop}
        />
      )}
    </LiveSessionContext.Provider>
  )
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

function parseRole(metadata?: string): string | null {
  if (!metadata) return null
  try {
    const parsed = JSON.parse(metadata)
    return typeof parsed?.role === "string" ? parsed.role : null
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

function LiveSessionHost({
  config,
  inlineTarget,
  onClose,
}: {
  config: LiveSessionConfig
  inlineTarget: HTMLElement | null
  onClose: () => void
}) {
  const { roomName, user, isAr, mode } = config
  const { minimize, expand } = useLiveSession()
  const { toast } = useToast()
  const [token, setToken] = useState("")
  const [joinError, setJoinError] = useState("")

  // Stable DOM node that hosts the room. It is created once and then moved
  // around the document without ever being recreated, so the LiveKitRoom — and
  // therefore the connection — is never unmounted by navigation.
  const containerRef = useRef<HTMLDivElement | null>(null)
  if (containerRef.current === null && typeof document !== "undefined") {
    containerRef.current = document.createElement("div")
  }
  const container = containerRef.current

  const expanded = Boolean(inlineTarget)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    if (inlineTarget) {
      node.className = "h-full w-full"
      node.style.cssText = ""
      if (node.parentElement !== inlineTarget) inlineTarget.appendChild(node)
    } else {
      node.className =
        "fixed bottom-4 end-4 z-[70] h-[200px] w-[320px] overflow-hidden rounded-xl border bg-background shadow-2xl"
      if (node.parentElement !== document.body) document.body.appendChild(node)
    }
  }, [inlineTarget])

  // Remove the detached container once the session host unmounts.
  useEffect(() => {
    return () => {
      const node = containerRef.current
      if (node?.parentElement) node.parentElement.removeChild(node)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setToken("")
    setJoinError("")
    ;(async () => {
      try {
        const resp = await fetch(
          `/api/livekit?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(user.name || user.id)}`
        )
        const data = await resp.json()
        if (!resp.ok || !data.token) {
          throw new Error(data?.error || `HTTP ${resp.status}`)
        }
        if (!cancelled) setToken(data.token)
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setJoinError((e as Error)?.message || "unknown")
        toast({
          title: isAr ? "خطأ" : "Error",
          description: isAr ? "فشل في الاتصال بالخادم" : "Failed to connect to server",
          variant: "destructive",
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [roomName, user.id, user.name, isAr, toast])

  const effectiveMode = useMemo<"student" | "instructor">(() => {
    if (mode) return mode
    return user.role === "instructor" || user.role === "admin" ? "instructor" : "student"
  }, [mode, user.role])

  const shouldAutoEnableAv = effectiveMode === "instructor"

  if (!container) return null

  let body: ReactNode
  if (joinError) {
    body = (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-background p-3 text-center">
        <span className="text-sm font-medium text-destructive">
          {isAr ? "تعذّر الانضمام للجلسة" : "Couldn't join the session"}
        </span>
        <span className="text-xs text-muted-foreground">{joinError}</span>
        <Button variant="outline" size="sm" className="mt-2" onClick={onClose}>
          {isAr ? "إغلاق" : "Close"}
        </Button>
      </div>
    )
  } else if (!token) {
    body = (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ms-2 text-sm text-muted-foreground">
          {isAr ? "جاري الانضمام..." : "Joining Class..."}
        </span>
      </div>
    )
  } else {
    body = (
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
          onClose()
        }}
      >
        <RoomAudioRenderer />
        <ClassroomUI
          isAr={isAr}
          user={user}
          effectiveMode={effectiveMode}
          expanded={expanded}
          onExpand={expand}
          onMinimize={minimize}
          onClose={onClose}
        />
      </LiveKitRoom>
    )
  }

  return createPortal(
    <div dir={isAr ? "rtl" : "ltr"} className="h-full w-full">
      {body}
    </div>,
    container
  )
}

function EmptyStage() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
    </div>
  )
}

/**
 * Returns at most one track reference per participant. LiveKit's `useTracks`
 * can surface several entries for the same participant (e.g. a placeholder plus
 * a published track), which used to render the same person multiple times. We
 * keep the best available track, preferring screen share over camera.
 */
function useUniqueTracks() {
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: false }
  )

  return useMemo(() => {
    const byParticipant = new Map<string, TrackReferenceOrPlaceholder>()
    for (const track of tracks) {
      const identity = track.participant.identity
      const existing = byParticipant.get(identity)
      if (!existing) {
        byParticipant.set(identity, track)
        continue
      }
      const trackIsScreenShare = track.source === Track.Source.ScreenShare
      const existingIsScreenShare = existing.source === Track.Source.ScreenShare
      if (trackIsScreenShare && !existingIsScreenShare) {
        byParticipant.set(identity, track)
      } else if (trackIsScreenShare === existingIsScreenShare) {
        if (isTrackReference(track) && !isTrackReference(existing)) {
          byParticipant.set(identity, track)
        }
      }
    }
    return [...byParticipant.values()]
  }, [tracks])
}

function VideoStage({ isAr, compact }: { isAr: boolean; compact: boolean }) {
  const tracks = useUniqueTracks()

  if (compact) {
    const preferred =
      tracks.find((t) => parseRole(t.participant.metadata) === "instructor") || tracks[0]
    return (
      <div className="h-full w-full bg-background">
        {preferred ? <VideoTile trackRef={preferred} isAr={isAr} /> : <EmptyStage />}
      </div>
    )
  }

  return (
    <div className="h-full w-full p-3">
      <GridLayout tracks={tracks} className="h-full">
        <TrackLoop tracks={tracks}>
          <ParticipantVideoTile isAr={isAr} />
        </TrackLoop>
      </GridLayout>
    </div>
  )
}

function VideoTile({ trackRef, isAr }: { trackRef: TrackReferenceOrPlaceholder; isAr: boolean }) {
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

function ParticipantVideoTile({ isAr }: { isAr: boolean }) {
  const trackRef = useTrackRefContext()
  return <VideoTile trackRef={trackRef} isAr={isAr} />
}

function ChatPanel({ isAr, onClose }: { isAr: boolean; onClose: () => void }) {
  const { chatMessages, send, isSending } = useChat()
  const [text, setText] = useState("")
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value || isSending) return
    setText("")
    try {
      await send(value)
    } catch {
      setText(value)
    }
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-s bg-background xl:w-80">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-primary" />
          {isAr ? "المحادثة" : "Chat"}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 scrollbar-hide">
        {chatMessages.length === 0 ? (
          <p className="pt-6 text-center text-xs text-muted-foreground">
            {isAr ? "لا توجد رسائل بعد. ابدأ المحادثة." : "No messages yet. Start the conversation."}
          </p>
        ) : (
          chatMessages.map((msg: ReceivedChatMessage) => {
            const isSelf = msg.from?.identity === undefined ? false : msg.from.isLocal
            return (
              <div key={msg.id ?? `${msg.timestamp}`} className={cn("flex flex-col gap-0.5", isSelf && "items-end")}>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {isSelf ? (isAr ? "أنت" : "You") : msg.from?.name || msg.from?.identity || (isAr ? "مشارك" : "Participant")}
                </span>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words",
                    isSelf ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  )}
                >
                  {msg.message}
                </div>
              </div>
            )
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isAr ? "اكتب رسالة..." : "Type a message..."}
          className="h-9 min-w-0 flex-1 rounded-md border bg-transparent px-3 text-sm outline-none focus:border-primary"
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!text.trim() || isSending}>
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </aside>
  )
}

function ClassroomUI({
  isAr,
  user,
  effectiveMode,
  expanded,
  onExpand,
  onMinimize,
  onClose,
}: {
  isAr: boolean
  user: UserInfo
  effectiveMode: "student" | "instructor"
  expanded: boolean
  onExpand: () => void
  onMinimize: () => void
  onClose: () => void
}) {
  const room = useRoomContext()
  const { toast } = useToast()
  const [raisedHands, setRaisedHands] = useState<string[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showChat, setShowChat] = useState(true)
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
          setRaisedHands((prev) => (prev.includes(whoName) ? prev : [...prev, whoName]))
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
    await room.localParticipant.publishData(encoder.encode(data), { reliable: true })
    setIsHandRaised(nextRaised)
    toast({
      title: nextRaised ? (isAr ? "تم رفع اليد" : "Hand Raised") : (isAr ? "تم خفض اليد" : "Hand Lowered"),
      description: nextRaised
        ? isAr
          ? "لقد قمت برفع يدك للمدرس"
          : "You raised your hand to the instructor"
        : isAr
          ? "لقد أنزلت يدك"
          : "You lowered your hand",
    })
  }

  const broadcast = async (type: "FORCE_MUTE" | "FORCE_CAMERA_OFF") => {
    const data = JSON.stringify({ type })
    const encoder = new TextEncoder()
    await room.localParticipant.publishData(encoder.encode(data), { reliable: true })
  }

  const startRecording = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
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

  // Floating mini player while the user browses the rest of the site
  if (!expanded) {
    return (
      <div className="relative h-full w-full">
        <VideoStage isAr={isAr} compact />
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 bg-black/55 px-1.5 py-1 backdrop-blur-sm">
          <span className="truncate px-1 text-xs font-medium text-white">
            {isAr ? "جلسة مباشرة" : "Live session"}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7"
              onClick={onExpand}
              title={isAr ? "العودة للجلسة" : "Back to session"}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              title={isAr ? "مغادرة الجلسة" : "Leave session"}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-background">
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1">
          <VideoStage isAr={isAr} compact={false} />
        </div>
        {showChat && <ChatPanel isAr={isAr} onClose={() => setShowChat(false)} />}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-background/95 px-2 py-1.5">
        <ControlBar variation="minimal" controls={{ chat: false, settings: false }} />
        <div className="flex items-center gap-1">
          <Button
            variant={showChat ? "default" : "secondary"}
            size="sm"
            onClick={() => setShowChat((v) => !v)}
            title={isAr ? "المحادثة" : "Chat"}
          >
            <MessageSquare className="me-2 h-4 w-4" />
            {isAr ? "المحادثة" : "Chat"}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9"
            onClick={onMinimize}
            title={isAr ? "تصغير الجلسة" : "Minimize session"}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Student Controls */}
      {!isInstructorView && (
        <div
          className={cn(
            "absolute top-4 left-4 z-40 flex flex-wrap items-center gap-2",
            isAr && "left-auto right-4"
          )}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleRaiseHand}
            className="bg-background/80 shadow-lg backdrop-blur-sm hover:bg-background"
            aria-pressed={isHandRaised}
          >
            <Hand
              className={cn(
                "me-2 h-4 w-4",
                isHandRaised ? "text-yellow-500" : "text-muted-foreground"
              )}
            />
            {isAr ? (isHandRaised ? "خفض اليد" : "رفع اليد") : isHandRaised ? "Lower Hand" : "Raise Hand"}
          </Button>
        </div>
      )}

      {/* Instructor Controls */}
      {isInstructorView && (
        <aside
          className={cn(
            "absolute top-4 z-40 rounded-lg border bg-background/80 shadow-lg backdrop-blur-sm transition-all duration-300",
            isAr ? "left-4" : "right-4",
            isCollapsed ? "w-12" : "w-64"
          )}
        >
          <div className={cn("flex items-center justify-between border-b p-3", isCollapsed && "justify-center p-2")}>
            {!isCollapsed && <span className="text-sm font-semibold">{isAr ? "تحكم البث" : "Live Controls"}</span>}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsCollapsed(!isCollapsed)}>
              {isCollapsed ? (
                isAr ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )
              ) : isAr ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>

          {!isCollapsed && (
            <>
              <div className="space-y-2 p-3">
                <Button variant="secondary" size="sm" className="w-full justify-start" onClick={handleMuteAll}>
                  <MicOff className="me-2 h-4 w-4" />
                  {isAr ? "كتم الطلاب" : "Mute Students"}
                </Button>
                <Button variant="secondary" size="sm" className="w-full justify-start" onClick={handleCameraOffAll}>
                  <VideoOff className="me-2 h-4 w-4" />
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
                      "me-2 h-3 w-3 rounded-full",
                      isRecording ? "animate-pulse bg-red-600" : "bg-green-600"
                    )}
                  />
                  {isRecording
                    ? isAr
                      ? "إيقاف التسجيل"
                      : "Stop Recording"
                    : isAr
                      ? "بدء التسجيل"
                      : "Start Recording"}
                </Button>
              </div>
              {raisedHands.length > 0 && (
                <div className="border-t p-3 text-xs text-muted-foreground">
                  <div className="mb-1 font-medium">{isAr ? "أيدي مرفوعة:" : "Raised Hands:"}</div>
                  <div className="space-y-1">
                    {raisedHands.map((n) => (
                      <div key={n} className="truncate">
                        {n}
                      </div>
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

/**
 * Mounted by a live page. Registers the session with the provider (which owns
 * the actual room) and exposes an inline element the room is rendered into.
 * When the user navigates away this component unmounts, the inline target
 * disappears, and the session keeps running as a floating mini player.
 */
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
  const { config, start, setPageTarget } = useLiveSession()
  const pathname = usePathname()
  const inlineRef = useRef<HTMLDivElement | null>(null)
  const autoStartedRef = useRef(false)

  const active = config?.roomName === roomName

  // Join automatically the first time the page is opened.
  useEffect(() => {
    if (autoStartedRef.current) return
    autoStartedRef.current = true
    start({ roomName, user, isAr, mode, href: pathname })
  }, [roomName, user, isAr, mode, pathname, start])

  // Publish the inline slot to the provider while this page is showing.
  useEffect(() => {
    if (!active) return
    const el = inlineRef.current
    if (!el) return
    setPageTarget(el)
    return () => setPageTarget(null)
  }, [active, setPageTarget])

  if (!active) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg border bg-muted/30">
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <Video className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isAr ? "أنت غير متصل بالجلسة المباشرة" : "You are not connected to the live session"}
          </p>
          <Button onClick={() => start({ roomName, user, isAr, mode, href: pathname })}>
            {isAr ? "الانضمام للجلسة" : "Join live session"}
          </Button>
        </div>
      </div>
    )
  }

  return <div ref={inlineRef} className="h-full w-full" />
}
