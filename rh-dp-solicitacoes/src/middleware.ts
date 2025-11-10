import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // tenta recuperar sessão (com pequena tolerância)
  let { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    await new Promise(r => setTimeout(r, 120))
    session = (await supabase.auth.getSession()).data.session
  }

  const url = req.nextUrl
  const isProtected =
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/app') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/solicitacoes') ||
    url.pathname.startsWith('/configuracoes')

  if (!session && isProtected) {
    const loginUrl = new URL('/login', url.origin)
    loginUrl.searchParams.set('next', url.pathname + url.search)
    return NextResponse.redirect(loginUrl)
  }

  if (session && url.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', url.origin))
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/app/:path*',
    '/admin/:path*',
    '/solicitacoes/:path*',
    '/configuracoes/:path*',
    '/login',
  ],
}
