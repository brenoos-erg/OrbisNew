// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const path = req.nextUrl.pathname
  const isDashboard = path.startsWith('/dashboard')
  const isProtectedApi = path.startsWith('/api/configuracoes')
  const isLogin = path === '/login'

  // 🔒 se não tiver sessão e tentar acessar dashboard ou API protegida → redireciona pro login
  if ((isDashboard || isProtectedApi) && !session) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectedFrom', path)
    return NextResponse.redirect(url)
  }

  // se já estiver logado e for pra /login → manda pro dashboard
  if (isLogin && session) {
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
