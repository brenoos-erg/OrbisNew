import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_COOKIE_NAME } from '@/lib/auth-constants'

export async function proxy(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname

  const isPublic =
    path.startsWith('/login') ||
    path.startsWith('/primeiro-acesso') ||
    path.startsWith('/auth/reset-password') ||
    path.startsWith('/_next') ||
    path.startsWith('/api/auth') ||
    path.startsWith('/api/health') ||
    path.startsWith('/api/session') ||
    /\.[a-z0-9]+$/i.test(path)

  if (isPublic) return NextResponse.next()

  if (!req.cookies.get(AUTH_COOKIE_NAME)?.value) {
    const loginUrl = new URL('/login', url.origin)
    loginUrl.searchParams.set('next', path + url.search)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next|.*\\..*).*)'] }