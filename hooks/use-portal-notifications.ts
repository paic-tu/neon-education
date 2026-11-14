"use client"

import { useSyncExternalStore } from "react"
import { useAuth } from "@/lib/auth-context"
import { createPollingStore } from "@/lib/client-polling-store"

const unreadStores = new Map<string, ReturnType<typeof createPollingStore<number>>>()
type LiveCourse = { id: string; titleEn: string; titleAr: string }
const liveStores = new Map<string, ReturnType<typeof createPollingStore<LiveCourse[]>>>()
const emptyCourses: LiveCourse[] = []
const noSubscribe = () => () => {}
const zero = () => 0
const empty = () => emptyCourses

export function useUnreadMessageCount() {
  const { user } = useAuth()
  const userId = user?.id as string | undefined
  let store = userId ? unreadStores.get(userId) : undefined
  if (userId && !store) {
    store = createPollingStore(0, async (signal) => {
      const response = await fetch("/api/messages/unread-count", { signal, cache: "no-store" })
      if (!response.ok) throw new Error("Unable to load unread count")
      return Number((await response.json()).count) || 0
    }, 30_000)
    unreadStores.set(userId, store)
  }
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.getSnapshot ?? zero, zero)
}

export function useLiveCourses() {
  const { user } = useAuth()
  const userId = user?.id as string | undefined
  let store = userId ? liveStores.get(userId) : undefined
  if (userId && !store) {
    store = createPollingStore<LiveCourse[]>(emptyCourses, async (signal) => {
      const response = await fetch("/api/live/courses", { signal, cache: "no-store" })
      if (!response.ok) throw new Error("Unable to load live courses")
      const courses = (await response.json()).courses
      return Array.isArray(courses) ? courses.slice(0, 10) : emptyCourses
    }, (courses) => courses.length ? 30_000 : 120_000)
    liveStores.set(userId, store)
  }
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.getSnapshot ?? empty, empty)
}
