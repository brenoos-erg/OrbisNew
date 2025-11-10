// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  let session = null
  try {
    const { data } = await supabase.auth.getSession()
    session = data.session
  } catch (error) {
    console.error('middleware auth check failed', error)
  }

  const path = req.nextUrl.pathname
  const isDashboard = path.startsWith('/dashboard')
  const isProtectedApi = path.startsWith('/api/configuracoes')
  const isLogin = path === '/login'

  const hasAuthCookie =
    Boolean(req.cookies.get('sb-access-token')?.value) ||
    Boolean(req.cookies.get('sb-refresh-token')?.value)

  // Não logado tentando acessar páginas / APIs protegidas
  if ((isDashboard || isProtectedApi) && !session && !hasAuthCookie) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectedFrom', path)
    return NextResponse.redirect(url)
  }

  // Já logado tentando ir para /login → manda para /dashboard
  if (isLogin && (session || hasAuthCookie)) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/configuracoes/:path*',
    '/login',
  ],
}
