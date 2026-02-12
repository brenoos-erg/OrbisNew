import { performance } from 'node:perf_hooks'
import { ModuleLevel, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserModuleLevels } from '@/lib/moduleAccess'
import { isDbUnavailableError } from '@/lib/db-unavailable'
import { ensureRequestContext, logTiming, memoizeRequest } from '@/lib/request-metrics'
import { readSessionFromCookies } from '@/lib/auth-local'

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
  mustChangePassword: true,
  department: { select: { id: true, code: true, name: true } },
}

export type SelectedAppUser = Prisma.UserGetPayload<{ select: typeof appUserSelect }>

export type CurrentAppUserResult = {
  appUser: (SelectedAppUser & { moduleLevels?: Record<string, ModuleLevel> }) | null
  session: { userId: string; issuedAt?: number } | null
  dbUnavailable: boolean
}

async function resolveAppUserFromSession(
  session: { userId: string; issuedAt?: number } | null,
): Promise<CurrentAppUserResult> {
  if (!session) return { appUser: null, session: null, dbUnavailable: false }

  try {
    const lookupStartedAt = performance.now()
    const appUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: appUserSelect,
    })
    logTiming('prisma.user.findUnique(session.userId)', lookupStartedAt)

    if (!appUser) return { appUser: null, session, dbUnavailable: false }

    const levelsStartedAt = performance.now()
    const moduleLevels = await getUserModuleLevels(appUser.id)
    logTiming('prisma.moduleLevels.load', levelsStartedAt)

    return { appUser: { ...appUser, moduleLevels }, session, dbUnavailable: false }
  } catch (error) {
    if (isDbUnavailableError(error)) {
      console.error('Não foi possível conectar ao banco de dados para buscar usuário', error)
      return { appUser: null, session, dbUnavailable: true }
    }

    console.error('Erro ao buscar usuário no banco de dados', error)
    return { appUser: null, session, dbUnavailable: false }
  }
}

async function loadCurrentUser(): Promise<CurrentAppUserResult> {
  return resolveAppUserFromSession(readSessionFromCookies())
}

export async function getCurrentAppUser() {
  return ensureRequestContext('auth/getCurrentAppUser', () =>
    memoizeRequest('auth/getCurrentAppUser', () => loadCurrentUser()),
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
