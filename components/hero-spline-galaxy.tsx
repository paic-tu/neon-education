"use client"

import dynamic from "next/dynamic"

const Spline = dynamic(() => import("./spline-renderer"), { ssr: false })
const GALAXY_SCENE_URL = "https://prod.spline.design/s4hqsmIAc0pCeGal/scene.splinecode"

export function HeroSplineGalaxy({ className = "" }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <Spline scene={GALAXY_SCENE_URL} style={{ width: "100%", height: "100%", transform: "scale(1.6)" }} />
    </div>
  )
}
