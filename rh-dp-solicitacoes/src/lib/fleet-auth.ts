'use client'

import { clearSessionMeCache } from '@/lib/session-cache'

export function handleFleetUnauthorized(response: Response) {
  if (response.status !== 401) {
    return false
  }

  clearSessionMeCache()

  if (typeof window !== 'undefined') {
    const nextUrl = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
    window.location.assign(`/login?next=${nextUrl}`)
  }

  return true
}