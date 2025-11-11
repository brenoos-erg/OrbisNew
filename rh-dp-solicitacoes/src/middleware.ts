// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const url = req.nextUrl
  const path = url.pathname

  const isPublic =
    path.startsWith('/login') ||
    path.startsWith('/_next') ||
    path.startsWith('/api/test-session') ||
    /\.[a-z0-9]+$/i.test(path) // arquivos estáticos

  if (!session && !isPublic) {
    const loginUrl = new URL('/login', url.origin)
    loginUrl.searchParams.set('next', path + url.search)
    return NextResponse.redirect(loginUrl)
  }

  // força a página de primeiro acesso se o flag estiver ligado
  const must = (session?.user?.user_metadata as any)?.mustChangePassword === true
  const isFirstAccessPage = path.startsWith('/primeiro-acesso')
  if (session && must && !isFirstAccessPage) {
    const fa = new URL('/primeiro-acesso', url.origin)
    fa.searchParams.set('next', path + url.search)
    return NextResponse.redirect(fa)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}
