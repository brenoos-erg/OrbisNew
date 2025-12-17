// src/app/api/session/me/route.ts
import { NextResponse } from 'next/server'
import { getCurrentAppUser } from '@/lib/auth'
import { withRequestMetrics } from '@/lib/request-metrics'
export const dynamic = 'force-dynamic'

export async function GET() {
  return withRequestMetrics('GET /api/session/me', async () => {
    const { appUser, session, dbUnavailable } = await getCurrentAppUser()
    return NextResponse.json({ appUser, session, dbUnavailable })
  })
}