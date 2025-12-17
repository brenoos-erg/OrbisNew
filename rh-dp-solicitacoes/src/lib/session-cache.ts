'use client'

export type SessionMePayload = {
  appUser?: any
  session?: any
  dbUnavailable?: boolean
}

const SESSION_CACHE_TTL_MS = 15_000

let cachedPayload: SessionMePayload | null = null
let cacheExpiresAt = 0
let inflightRequest: Promise<SessionMePayload | null> | null = null

async function requestSessionMe(): Promise<SessionMePayload | null> {
  try {
    const res = await fetch('/api/session/me', { cache: 'no-store' })
    if (!res.ok) return null

    const data = await res.json().catch(() => null)
    return data as SessionMePayload | null
  } catch {
    return null
  }
}

export async function fetchSessionMe(options?: { force?: boolean }) {
  const now = Date.now()
  const bypassCache = options?.force === true

  if (!bypassCache && cachedPayload && cacheExpiresAt > now) {
    return cachedPayload
  }

  if (!bypassCache && inflightRequest) {
    return inflightRequest
  }

  const pending = requestSessionMe().then((payload) => {
    if (payload) {
      cachedPayload = payload
      cacheExpiresAt = Date.now() + SESSION_CACHE_TTL_MS
    }

    return payload
  })

  if (!bypassCache) {
    inflightRequest = pending
    pending.finally(() => {
      if (inflightRequest === pending) inflightRequest = null
    })
  }

  return pending
}

export function clearSessionMeCache() {
  cachedPayload = null
  cacheExpiresAt = 0
  inflightRequest = null
}