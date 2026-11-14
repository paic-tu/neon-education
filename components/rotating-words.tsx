"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

type Word = { text: string; className?: string }

export function RotatingWords({
  words,
  interval = 2600,
  marginInlineStart = "-2.20em",
}: {
  words: Word[]
  interval?: number
  marginInlineStart?: string
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!words.length) return
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    let timer: ReturnType<typeof setInterval> | undefined
    const sync = () => {
      if (timer) clearInterval(timer)
      timer = undefined
      if (document.visibilityState === "visible" && !motionQuery.matches) {
        timer = setInterval(() => setIndex((i) => (i + 1) % words.length), interval)
      }
    }
    sync()
    document.addEventListener("visibilitychange", sync)
    motionQuery.addEventListener("change", sync)
    return () => {
      if (timer) clearInterval(timer)
      document.removeEventListener("visibilitychange", sync)
      motionQuery.removeEventListener("change", sync)
    }
  }, [words.length, interval])

  const word = words[index % words.length]
  const minWidthCh = Math.max(0, ...words.map((w) => w.text.length))

  return (
    <span
      className="relative inline-block align-baseline overflow-hidden whitespace-nowrap"
      style={{
        minWidth: `${minWidthCh}ch`,
        height: "1.35em",
        lineHeight: "1.23em",
        marginInlineStart,
        letterSpacing: "normal",
        textAlign: "left",
      }}
    >
      {word && (
        <AnimatePresence mode="wait">
          <motion.span
            key={index}
            initial={{ y: "1em", opacity: 0 }}
            animate={{ y: "0em", opacity: 1 }}
            exit={{ y: "-1em", opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={["inline-block whitespace-nowrap", word.className].filter(Boolean).join(" ")}
          >
            {word.text}
          </motion.span>
        </AnimatePresence>
      )}
    </span>
  )
}
