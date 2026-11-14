"use client"

import { useEffect, useRef, useState } from "react"
import { useInView } from "framer-motion"

interface AnimatedCounterProps {
  value: number
  duration?: number
  suffix?: string
  className?: string
}

export function AnimatedCounter({ value, duration = 2000, suffix = "", className = "" }: AnimatedCounterProps) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  useEffect(() => {
    if (!isInView) return
    if (duration <= 0) {
      setCount(value)
      return
    }
    const startTime = Date.now()
    let frame = 0
    const animate = () => {
      const progress = Math.min((Date.now() - startTime) / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setCount(progress < 1 ? Math.floor(easeOut * value) : value)
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    // Stats arrive asynchronously; restart for the new value without leaking frames.
    return () => cancelAnimationFrame(frame)
  }, [isInView, value, duration])

  return (
    <div ref={ref} className={className}>
      {count}
      {suffix}
    </div>
  )
}
