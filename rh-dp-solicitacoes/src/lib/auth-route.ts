import { cookies } from 'next/headers'
import { performance } from 'node:perf_hooks'
import { randomUUID } from 'node:crypto'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { AuthError } from '@supabase/supabase-js'
import { ensureRequestContext, logTiming, memoizeRequest } from '@/lib/request-metrics'
import {
  resolveAppUserFromSessionUser,
  type CurrentAppUserResult,
} from '@/lib/auth'

export type CurrentRouteAppUserResult = CurrentAppUserResult & {
  requestId: string
}

const getSupabaseRouteClient = () =>
  createRouteHandlerClient({
    cookies: () => cookies(),
  })

function isRefreshableAuthError(error: AuthError | null) {
  if (!error) return false
  if (error.status === 401) return true
  const message = error.message?.toLowerCase() ?? ''
  return (
    message.includes('jwt') ||
    message.includes('expired') ||
    message.includes('invalid') ||
    message.includes('session')
  )
}

function logAuthError(context: string, requestId: string, error: AuthError | null) {
  if (!error) return
  console.warn(context, {
    requestId,
    message: error.message,
    status: error.status,
    name: error.name,
  })
}

async function loadCurrentUserForRoute(): Promise<CurrentRouteAppUserResult> {
  const requestId = randomUUID()
  const supabase = getSupabaseRouteClient()
  const authStartedAt = performance.now()

  const { data: userResult, error: userError } = await supabase.auth.getUser()
  logTiming('supabase.auth.getUser(route)', authStartedAt)

  if (userError) {
    logAuthError('Erro ao buscar usuário autenticado (route)', requestId, userError)

    if (isRefreshableAuthError(userError)) {
      const sessionStartedAt = performance.now()
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      logTiming('supabase.auth.getSession(route)', sessionStartedAt)
      logAuthError('Erro ao buscar sessão supabase (route)', requestId, sessionError)

      if (sessionData?.session) {
        const refreshStartedAt = performance.now()
        const { error: refreshError } = await supabase.auth.refreshSession()
        logTiming('supabase.auth.refreshSession(route)', refreshStartedAt)
        logAuthError('Erro ao atualizar sessão supabase (route)', requestId, refreshError)
      }

      const retryStartedAt = performance.now()
      const { data: retryUser, error: retryError } = await supabase.auth.getUser()
      logTiming('supabase.auth.getUser.retry(route)', retryStartedAt)
      if (!retryError && retryUser?.user) {
        const result = await resolveAppUserFromSessionUser(retryUser.user)
        return { ...result, requestId }
      }

      logAuthError('Erro ao revalidar usuário supabase (route)', requestId, retryError)
    }

    return { appUser: null, session: null, dbUnavailable: false, requestId }
  }

  const result = await resolveAppUserFromSessionUser(userResult.user)
  return { ...result, requestId }
}

export async function getCurrentAppUserFromRouteHandler() {
  return ensureRequestContext('auth/getCurrentAppUserRoute', () =>
    memoizeRequest('auth/getCurrentAppUserRoute', () => loadCurrentUserForRoute()),
  )
}