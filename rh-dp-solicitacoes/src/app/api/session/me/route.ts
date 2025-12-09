// src/app/api/session/me/route.ts
import { NextResponse } from 'next/server'
import { getCurrentAppUser } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { appUser, session } = await getCurrentAppUser()
  return NextResponse.json({ appUser, session })
}