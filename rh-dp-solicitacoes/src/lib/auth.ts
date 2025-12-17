// src/lib/auth.ts
import { cookies } from 'next/headers'
import { performance } from 'node:perf_hooks'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import type { User } from '@supabase/supabase-js'
import { ModuleLevel, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserModuleLevels } from '@/lib/moduleAccess'
import {
  ensureRequestContext,
  logTiming,
  memoizeRequest,
} from '@/lib/request-metrics'

const getSupabaseServerClient = () =>
  createServerComponentClient({
    cookies,
  })

export const appUserSelect = {
  id: true,
  email: true,
  fullName: true,
  login: true,
  phone: true,
  status: true,
  role: true,
  costCenterId: true,
  departmentId: true,
  department: { select: { id: true, code: true, name: true } },
}

export type SelectedAppUser = Prisma.UserGetPayload<{ select: typeof appUserSelect }>

export type CurrentAppUserResult = {
  appUser: (SelectedAppUser & { moduleLevels?: Record<string, ModuleLevel> }) | null
  session: { user: User } | null
  dbUnavailable: boolean
}

async function resolveAppUserFromSessionUser(
  sessionUser: User | null,
  seedUser?: SelectedAppUser | null,
): Promise<CurrentAppUserResult> {
  const session = sessionUser ? { user: sessionUser } : null

  if (!sessionUser) {
    return { appUser: null, session, dbUnavailable: false }
  }

  const authId = sessionUser.id
  const email = sessionUser.email ?? undefined

  let appUser = seedUser ?? null
  let dbUnavailable = false

  try {
    if (!appUser) {
      const lookupStartedAt = performance.now()
      appUser = await prisma.user.findUnique({
        where: { authId },
        select: appUserSelect,
      })
      logTiming('prisma.user.findUnique', lookupStartedAt)
    }

    if (!appUser && email) {
      const emailLookupStartedAt = performance.now()
      const userByEmail = await prisma.user.findUnique({
        where: { email },
        select: appUserSelect,

      })
      logTiming('prisma.user.findUnique(email)', emailLookupStartedAt)

      if (userByEmail) {
        const updateStartedAt = performance.now()
        appUser = await prisma.user.update({
          where: { id: userByEmail.id },
          data: { authId },
          select: appUserSelect,
        })
        logTiming('prisma.user.update.authId', updateStartedAt)
      }
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error('Não foi possível conectar ao banco de dados para buscar usuário', error)
      dbUnavailable = true
    } else {
      console.error('Erro ao buscar usuário no banco de dados', error)
    }

    return { appUser: null, session, dbUnavailable }
  }

  if (appUser) {
    const levelsStartedAt = performance.now()
    const moduleLevels = await getUserModuleLevels(appUser.id)
    logTiming('prisma.moduleLevels.load', levelsStartedAt)
    return { appUser: { ...appUser, moduleLevels }, session, dbUnavailable }
  }

  return { appUser, session, dbUnavailable }
}
async function loadCurrentUser(): Promise<CurrentAppUserResult> {
  const authStartedAt = performance.now()
  const supabase = getSupabaseServerClient()

  const { data: userResult, error: userError } = await supabase.auth.getUser()
  logTiming('supabase.auth.getUser', authStartedAt)

  if (userError) {
    console.error('Erro ao buscar usuário autenticado', userError)
    return { appUser: null, session: null, dbUnavailable: false }
  }

  return resolveAppUserFromSessionUser(userResult.user)
}

export async function getCurrentAppUser() {
  return ensureRequestContext('auth/getCurrentAppUser', () =>
    memoizeRequest('auth/getCurrentAppUser', () => loadCurrentUser()),
  )
}
export async function getCurrentAppUserFromSessionUser(
  sessionUser: User | null,
  seedUser?: SelectedAppUser | null,
): Promise<CurrentAppUserResult> {
  const key = `auth/getCurrentAppUser/${sessionUser?.id ?? 'anon'}`
  return ensureRequestContext('auth/getCurrentAppUser', () =>
    memoizeRequest(key, () => resolveAppUserFromSessionUser(sessionUser, seedUser)),
  )
}

export async function requireActiveUser() {
  const { appUser, dbUnavailable } = await getCurrentAppUser()

  if (!appUser) {
    if (dbUnavailable) {
      throw new Error('Serviço indisponível. Não foi possível conectar ao banco de dados.')
    }
    throw new Error('Usuário não autenticado')
  }

  if (appUser.status !== 'ATIVO') {
    throw new Error('Usuário inativo')
  }

  return appUser
}
