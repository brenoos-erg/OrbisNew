// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

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

  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', url.origin)
    loginUrl.searchParams.set('next', path + url.search)
    return NextResponse.redirect(loginUrl)
  }

  const must = (user.user_metadata as any)?.mustChangePassword === true
  const isFirstAccessPage = path.startsWith('/primeiro-acesso')
  if (must && !isFirstAccessPage) {
    const fa = new URL('/primeiro-acesso', url.origin)
    fa.searchParams.set('next', path + url.search)
    return NextResponse.redirect(fa)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}
