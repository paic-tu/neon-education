"use client"

import { useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import type { Application, SPEObject } from "@splinetool/runtime"

const Spline = dynamic(() => import("./spline-renderer"), { ssr: false })
const NEON_LOGO_SCENE_URL = "https://prod.spline.design/E5no7iml1pXoVM79/scene.splinecode"
const LOGO_OBJECT_NAME = "Update the logo shape to ma..."
const BASE_SCALE = 1.7
const MOBILE_SCALE_RATIO = 0.58
const MOBILE_WIDTH = 375
const DESKTOP_WIDTH = 1024

function getScaleForWidth(width: number) {
  const minScale = BASE_SCALE * MOBILE_SCALE_RATIO
  if (width <= MOBILE_WIDTH) return minScale
  if (width >= DESKTOP_WIDTH) return BASE_SCALE
  const t = (width - MOBILE_WIDTH) / (DESKTOP_WIDTH - MOBILE_WIDTH)
  return minScale + t * (BASE_SCALE - minScale)
}

export function NeonLogoSpline({ className = "" }: { className?: string }) {
  const logoRef = useRef<SPEObject | null>(null)

  useEffect(() => {
    const applyScale = () => {
      const logo = logoRef.current
      if (!logo) return
      const scale = getScaleForWidth(window.innerWidth)
      logo.scale.x = scale
      logo.scale.y = scale
      logo.scale.z = scale
    }
    applyScale()
    window.addEventListener("resize", applyScale)
    return () => window.removeEventListener("resize", applyScale)
  }, [])

  const handleLoad = (app: Application) => {
    const logo = app.findObjectByName(LOGO_OBJECT_NAME)
    if (!logo) return
    logoRef.current = logo
    const scale = getScaleForWidth(window.innerWidth)
    logo.scale.x = scale
    logo.scale.y = scale
    logo.scale.z = scale
  }

  return (
    <div className={className} aria-hidden="true">
      <Spline scene={NEON_LOGO_SCENE_URL} style={{ width: "100%", height: "100%" }} onLoad={handleLoad} />
    </div>
  )
}
