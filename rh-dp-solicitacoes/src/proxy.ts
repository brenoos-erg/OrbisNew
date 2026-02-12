import { NextRequest, NextResponse } from 'next/server'

import { AUTH_COOKIE_NAME } from '@/lib/auth-constants'

export function proxy(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const errorDescription = searchParams.get('error_description')

  if (code) {
    const url = req.nextUrl.clone()
    url.pathname = '/primeiro-acesso'
    url.search = ''
    url.searchParams.set('code', code)
    return NextResponse.redirect(url)
  }

  if (errorDescription) {
    const url = req.nextUrl.clone()
    url.pathname = '/primeiro-acesso'
    url.search = ''
    url.searchParams.set('error_description', errorDescription)
    return NextResponse.redirect(url)
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (token) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/'],
}