// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

const SUPABASE_COOKIE_RE = /^sb-.*-(auth|refresh)-token(\..+)?$/
const SUPABASE_COOKIE_NAMES = new Set([
  'sb-access-token',
  'sb-refresh-token',
  'supabase-auth-token',
])

function hasSupabaseSessionCookie(req: NextRequest) {
  const cookies = req.cookies.getAll()
  return cookies.some(({ name }) => SUPABASE_COOKIE_RE.test(name) || SUPABASE_COOKIE_NAMES.has(name))
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname

  const isPublic =
    path.startsWith('/login') ||
    path.startsWith('/primeiro-acesso') ||
    path.startsWith('/auth/reset-password') ||
    path.startsWith('/auth/callback') ||
    path.startsWith('/_next') ||
    path.startsWith('/api/auth') ||
    path.startsWith('/api/health') ||
    path.startsWith('/api/session') ||
    path.startsWith('/api/test-session') ||
    /\.[a-z0-9]+$/i.test(path)

  // ✅ IMPORTANTÍSSIMO: não chama Supabase no Edge em rota pública
  if (isPublic) {
    return NextResponse.next()
  }

  if (!hasSupabaseSessionCookie(req)) {
    const loginUrl = new URL('/login', url.origin)
    loginUrl.searchParams.set('next', path + url.search)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}
