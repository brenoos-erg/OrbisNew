export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// src/app/api/session/me/route.ts
import { NextResponse } from 'next/server'
import { getCurrentAppUserFromRouteHandler } from '@/lib/auth-route'
import { withRequestMetrics } from '@/lib/request-metrics'

export async function GET() {
  return withRequestMetrics('GET /api/session/me', async () => {
    const { appUser, session, dbUnavailable, requestId } = await getCurrentAppUserFromRouteHandler()

    if (dbUnavailable) {
      return NextResponse.json(
        { appUser: null, session, dbUnavailable: true, requestId },
        { status: 503 },
      )
    }

    if (!session) {
      return NextResponse.json(
        { appUser: null, session: null, dbUnavailable: false, requestId },
        { status: 401 },
      )
    }

    if (!appUser) {
      return NextResponse.json(
        { appUser: null, session, dbUnavailable: false, requestId },
        { status: 404 },
      )
    }

    return NextResponse.json({ appUser, session, dbUnavailable, requestId })
  })
}