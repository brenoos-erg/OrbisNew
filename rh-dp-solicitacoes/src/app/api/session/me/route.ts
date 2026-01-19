export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// src/app/api/session/me/route.ts
import { NextResponse } from 'next/server'
import { getCurrentAppUserFromRouteHandler } from '@/lib/auth-route'
import { withRequestMetrics } from '@/lib/request-metrics'

export async function GET() {
  return withRequestMetrics('GET /api/session/me', async () => {
    const { appUser, session, dbUnavailable } = await getCurrentAppUserFromRouteHandler()
    return NextResponse.json({ appUser, session, dbUnavailable })
  })
}