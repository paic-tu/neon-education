"use client"

import { useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { useTheme } from "@/lib/theme-context"
import { lightGradientConfig, darkGradientConfig } from "./gradient-configs"
import { DARK_THEME, LIGHT_THEME } from "./themes"
import styles from "./SiteBackground.module.css"

const AnimatedGradient = dynamic(() => import("./AnimatedGradient"), { ssr: false })

// الصفحات ذات الخلفية المعتمة لا تحتاج تشغيل طبقات الرسم والحركة خلف محتواها.
const OPAQUE_PAGE_PATH_PATTERN = /^\/[a-z]{2}\/(student|instructor|admin|orders|tickets)(\/|$)/

export function AnimatedGradientBackground() {
  const { theme } = useTheme()
  const pathname = usePathname()
  const isOpaquePageRoute = OPAQUE_PAGE_PATH_PATTERN.test(pathname || "")
  const galaxyCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (isOpaquePageRoute) return
    const canvas = galaxyCanvasRef.current
    if (!canvas) return
    let cancelled = false
    let stop: (() => void) | undefined
    // A route change can unmount the canvas before its engine finishes loading.
    void import("./engine").then(({ startBackgroundAnimation }) => {
      if (!cancelled) stop = startBackgroundAnimation(canvas, theme === "dark" ? DARK_THEME : LIGHT_THEME)
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [theme, isOpaquePageRoute])

  if (isOpaquePageRoute) return null

  return (
    <>
      <div aria-hidden="true" className={`${styles.wrapper} ${styles.galaxyLayer}`}>
        <canvas ref={galaxyCanvasRef} className={styles.canvas} />
      </div>
      <div
        aria-hidden="true"
        className={styles.wrapper}
        style={
          theme === "dark"
            ? { opacity: 0.4, mixBlendMode: "screen" }
            : { opacity: 0.55, mixBlendMode: "multiply" }
        }
      >
        <AnimatedGradient
          config={theme === "dark" ? darkGradientConfig : lightGradientConfig}
          style={{ position: "absolute", inset: 0, zIndex: 0 }}
          speedBoost={1.65}
          speedBoostDuration={4.5}
        />
      </div>
      <div aria-hidden="true" className={`${styles.wrapper} ${styles.atmosphereLayer}`} />
    </>
  )
}
