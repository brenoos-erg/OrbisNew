import { NextResponse } from 'next/server'
import { clearAuthCookie, isSecureRequest } from '@/lib/auth-local'

export async function POST(req: Request) {
  const secure = isSecureRequest(req)
  const res = NextResponse.json({ ok: true })
  clearAuthCookie(res, secure)
  return res
}