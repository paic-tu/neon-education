import { unstable_cache } from "next/cache"
import { NextResponse } from "next/server"
import { getLandingPageReviews, getLandingPageStats } from "@/lib/actions/stats"

const getPublicLandingData = unstable_cache(async () => {
  const [stats, reviews] = await Promise.all([getLandingPageStats(), getLandingPageReviews()])
  return { stats, reviews }
}, ["public-landing-data-v1"], { revalidate: 60 })

export async function GET() {
  const data = await getPublicLandingData()
  return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } })
}
