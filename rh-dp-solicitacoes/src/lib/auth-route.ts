import { randomUUID } from 'node:crypto'
import { ensureRequestContext, memoizeRequest } from '@/lib/request-metrics'
import { getCurrentAppUser, type CurrentAppUserResult } from '@/lib/auth'

export type CurrentRouteAppUserResult = CurrentAppUserResult & {
  requestId: string
}


async function loadCurrentUserForRoute(): Promise<CurrentRouteAppUserResult> {
  const requestId = randomUUID()
  const result = await getCurrentAppUser()
  return { ...result, requestId }
}

export async function getCurrentAppUserFromRouteHandler() {
  return ensureRequestContext('auth/getCurrentAppUserRoute', () =>
    memoizeRequest('auth/getCurrentAppUserRoute', () => loadCurrentUserForRoute()),
  )
}