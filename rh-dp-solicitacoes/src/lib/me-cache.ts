'use client'

import type { ModuleLevel } from '@prisma/client'

export type MePayload = {
  id?: string
  fullName?: string
  email?: string
  login?: string
  phone?: string | null
  positionId?: string | null
  positionName?: string | null
  departmentId?: string | null
  departmentName?: string | null
  costCenterId?: string | null
  costCenterName?: string | null
  leaderId?: string | null
  leaderName?: string | null
  moduleLevels?: Record<string, ModuleLevel>
}

const ME_CACHE_TTL_MS = 60_000

let cachedMe: MePayload | null = null
let cacheExpiresAt = 0
let inflightRequest: Promise<MePayload | null> | null = null

async function requestMe(): Promise<MePayload | null> {
  const res = await fetch('/api/me', { cache: 'no-store' })
  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const err = new Error(
      (data as { error?: string })?.error || `Falha ao carregar /api/me (${res.status})`,
    ) as Error & { status?: number }
    err.status = res.status
    throw err
  }

  return data as MePayload
}

export async function fetchMe(options?: { force?: boolean }) {
  const now = Date.now()
  const bypassCache = options?.force === true

  if (!bypassCache && cachedMe && cacheExpiresAt > now) {
    return cachedMe
  }

  if (!bypassCache && inflightRequest) {
    return inflightRequest
  }

  const pending = requestMe().then((payload) => {
    if (payload) {
      cachedMe = payload
      cacheExpiresAt = Date.now() + ME_CACHE_TTL_MS
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

export function clearMeCache() {
  cachedMe = null
  cacheExpiresAt = 0
  inflightRequest = null
}