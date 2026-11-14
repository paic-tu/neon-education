"use client"

import dynamic from "next/dynamic"
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

export interface UserInfo {
  id: string
  name: string
  role: string
  image?: string
}

export interface LiveSessionConfig {
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
  setPageTarget: (el: HTMLElement | null) => void
  minimize: () => void
  expand: () => void
}

const LiveSessionContext = createContext<LiveSessionApi | null>(null)
const LiveSessionHost = dynamic(
  () => import("./live-classroom-client").then((module) => module.LiveSessionHost),
  { ssr: false },
)

export function useLiveSession(): LiveSessionApi {
  const context = useContext(LiveSessionContext)
  if (!context) throw new Error("useLiveSession must be used within a LiveSessionProvider")
  return context
}

// Keep the connection alive across portal navigation, but load LiveKit only on joining a room.
export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LiveSessionConfig | null>(null)
  const [pageTarget, setPageTargetState] = useState<HTMLElement | null>(null)
  const [floating, setFloating] = useState(false)

  const start = useCallback((next: LiveSessionConfig) => {
    setFloating(false)
    setConfig((previous) => {
      if (
        previous &&
        previous.roomName === next.roomName &&
        previous.user.id === next.user.id &&
        previous.user.name === next.user.name &&
        previous.user.role === next.user.role &&
        previous.isAr === next.isAr &&
        previous.mode === next.mode &&
        previous.href === next.href
      ) return previous
      return next
    })
  }, [])

  const stop = useCallback(() => {
    setFloating(false)
    setPageTargetState(null)
    setConfig(null)
  }, [])

  const setPageTarget = useCallback((element: HTMLElement | null) => {
    if (element) setFloating(false)
    setPageTargetState(element)
  }, [])
  const minimize = useCallback(() => setFloating(true), [])
  const expand = useCallback(() => setFloating(false), [])
  const expanded = Boolean(pageTarget) && !floating
  const api = useMemo(
    () => ({ config, expanded, start, stop, setPageTarget, minimize, expand }),
    [config, expanded, start, stop, setPageTarget, minimize, expand],
  )

  return (
    <LiveSessionContext.Provider value={api}>
      {children}
      {config && <LiveSessionHost config={config} inlineTarget={expanded ? pageTarget : null} onClose={stop} />}
    </LiveSessionContext.Provider>
  )
}
