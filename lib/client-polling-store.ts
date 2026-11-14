export function createPollingStore<T>(
  initialValue: T,
  load: (signal: AbortSignal) => Promise<T>,
  interval: number | ((value: T) => number),
) {
  let value = initialValue
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let generation = 0

  const clear = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
    controller?.abort()
    controller = undefined
    generation++
  }
  const available = () => document.visibilityState === "visible" && navigator.onLine !== false
  const notify = () => listeners.forEach((listener) => listener())

  const refresh = async () => {
    if (!listeners.size || !available() || controller) return
    if (timer) clearTimeout(timer)
    timer = undefined
    const currentGeneration = generation
    controller = new AbortController()
    try {
      const next = await load(controller.signal)
      if (currentGeneration !== generation || !listeners.size) return
      value = next
      notify()
    } catch {
      // Keep the last successful value until the next polling interval.
    } finally {
      if (currentGeneration === generation) {
        controller = undefined
        if (listeners.size && available()) {
          const delay = typeof interval === "function" ? interval(value) : interval
          timer = setTimeout(refresh, delay)
        }
      }
    }
  }
  const onAvailability = () => {
    if (available()) void refresh()
    else clear()
  }

  return {
    getSnapshot: () => value,
    getServerSnapshot: () => initialValue,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      if (listeners.size === 1) {
        document.addEventListener("visibilitychange", onAvailability)
        window.addEventListener("online", onAvailability)
        window.addEventListener("offline", onAvailability)
        void refresh()
      }
      return () => {
        listeners.delete(listener)
        if (!listeners.size) {
          clear()
          value = initialValue
          document.removeEventListener("visibilitychange", onAvailability)
          window.removeEventListener("online", onAvailability)
          window.removeEventListener("offline", onAvailability)
        }
      }
    },
  }
}
