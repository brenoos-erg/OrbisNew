// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          res.cookies.set({ name, value, ...options })
        },
        remove: (name: string, options: CookieOptions) => {
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  let { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    await new Promise(r => setTimeout(r, 120))
    session = (await supabase.auth.getSession()).data.session
  }

  const url = req.nextUrl
  const isPublic =
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/api/test-session') // opcional p/ debug

  if (!session && !isPublic) {
    const loginUrl = new URL('/login', url.origin)
    loginUrl.searchParams.set('next', url.pathname + url.search)
    return NextResponse.redirect(loginUrl)
  }

  // (Se quiser permitir ver /login mesmo logado, não redirecione aqui)
  return res
}

// APLICA EM TUDO, exceto assets/arquivos estáticos
export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}
