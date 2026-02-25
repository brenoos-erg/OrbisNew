import { NextResponse } from 'next/server'
import { getCurrentAppUser } from '@/lib/auth'
import { readSessionFromCookies } from '@/lib/auth-local'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const session = await readSessionFromCookies()
  const { appUser } = await getCurrentAppUser()

  return NextResponse.json({
    hasCookie: !!session,
    session,
    appUser,
  })
}