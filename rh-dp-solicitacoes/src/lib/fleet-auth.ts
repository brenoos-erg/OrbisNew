'use client'

import { clearSessionMeCache } from '@/lib/session-cache'

export function handleFleetUnauthorized(response: Response) {
  if (response.status === 401) {
    clearSessionMeCache()

    if (typeof window !== 'undefined') {
      const nextUrl = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
      window.location.assign(`/login?next=${nextUrl}`)
    }

    return true
  }

  if (response.status === 503) {
    if (typeof window !== 'undefined') {
      window.alert('Banco de dados indisponível no momento. Tente novamente em instantes.')
    }
    return true
  }

  return false
}