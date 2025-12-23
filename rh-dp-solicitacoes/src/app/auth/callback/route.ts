import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

function getSafeNext(nextParam: string | null) {
  if (!nextParam) return '/primeiro-acesso'
  return nextParam.startsWith('/') ? nextParam : '/primeiro-acesso'
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const nextParam = requestUrl.searchParams.get('next')
  const next = getSafeNext(nextParam)

  const redirectToLogin = (message?: string) => {
    const loginUrl = new URL('/login', requestUrl.origin)
    loginUrl.searchParams.set('next', next)
    if (message) {
      loginUrl.searchParams.set('error', message)
    }
    return NextResponse.redirect(loginUrl)
  }

  if (error) {
    return redirectToLogin(errorDescription || error)
  }

  if (!code) {
    return redirectToLogin('Link inválido ou expirado.')
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return redirectToLogin(exchangeError.message)
  }

  const destination = new URL(next, requestUrl.origin)
  return NextResponse.redirect(destination)
}