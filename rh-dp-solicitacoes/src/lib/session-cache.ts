'use client'

export type SessionMePayload = {
  appUser?: any
  session?: any
  dbUnavailable?: boolean
  error?: string
}

const SESSION_CACHE_TTL_MS = 15_000

let cachedPayload: SessionMePayload | null = null
let cacheExpiresAt = 0
let inflightRequest: Promise<SessionMePayload | null> | null = null

async function requestSessionMe(): Promise<SessionMePayload | null> {
  const res = await fetch('/api/session/bootstrap', { cache: 'no-store' })
  const data = await res.json().catch(() => null)

  const payload = data as SessionMePayload | null

  if (!res.ok) {
    if (payload?.dbUnavailable) {
      return {
        ...payload,
        dbUnavailable: true,
        error: payload.error || 'Banco de dados indisponível no momento.',
      }
    }

    const err = new Error(
      payload?.error || `Falha no bootstrap (status ${res.status})`,
    ) as Error & { status?: number; payload?: any }

    err.status = res.status
    err.payload = payload
    throw err
  }

  return payload
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