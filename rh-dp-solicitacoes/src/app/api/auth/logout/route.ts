import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/auth-local'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  clearAuthCookie(res)
  return res
}