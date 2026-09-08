import { AccessToken } from "livekit-server-sdk"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getEnrollment, getCourseById } from "@/lib/db/queries"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const room = req.nextUrl.searchParams.get("room")
  const username = req.nextUrl.searchParams.get("username")

  if (!room) {
    return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 })
  }

  const role = (session.user as any).role || "student"

  // ONLY allow rooms that are strictly tied to a course. Block:
  //  - consultation-tech (global room not bounded to any course)
  //  - consultation-<id> (separate per-course "consultation" rooms, not the actual course live session)
  // Only rooms of the form: course-<courseId>  are permitted.
  if (!room.startsWith("course-")) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 })
  }

  const courseId = room.replace("course-", "")
  if (!courseId) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 })
  }

  const course = await getCourseById(courseId)
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // The course must be configured as a LIVE course first (type = Live Course).
  if (!course.isLive) {
    return NextResponse.json({ error: "Not a live course" }, { status: 403 })
  }

  // -- Authorization per role --
  // Instructor/Admin may enter BEFORE isStreaming=true so they can kick off the broadcast.
  // Students may enter ONLY when the instructor has turned the stream ON (isStreaming=true).
  if (role === "student") {
    const enrollment = await getEnrollment(session.user.id, courseId)
    if (!enrollment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (!(course as any).isStreaming) {
      return NextResponse.json({ error: "Stream not active" }, { status: 403 })
    }
  } else if (role === "instructor") {
    if (course.instructorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  } else if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const displayName = username || session.user.name || session.user.id
  const identity = session.user.id
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: displayName,
    metadata: JSON.stringify({ 
      role, 
      userId: session.user.id,
      avatarUrl: session.user.image 
    }),
  })

  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: role === "instructor" || role === "admin",
  } as any)

  return NextResponse.json({ token: await at.toJwt() })
}
