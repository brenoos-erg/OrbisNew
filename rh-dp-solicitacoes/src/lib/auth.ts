// src/lib/auth.ts
import { cookies } from 'next/headers'
import { cache } from 'react'
import { performance } from 'node:perf_hooks'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserModuleLevels } from '@/lib/moduleAccess'
import { logTiming, withRequestMetrics } from '@/lib/request-metrics'

const getSupabaseServerClient = cache(() =>
  createServerComponentClient({
    cookies,
  }),
)

const loadCurrentUser = cache(async () => {
  const authStartedAt = performance.now()
  const supabase = getSupabaseServerClient()

  const { data: userResult, error: userError } = await supabase.auth.getUser()
  logTiming('supabase.auth.getUser', authStartedAt)

  if (userError) {
    console.error('Erro ao buscar usuário autenticado', userError)
    return { appUser: null, session: null }
  }

  const sessionUser = userResult.user

  if (!sessionUser) {
    return { appUser: null, session: null }
  }

  const authId = sessionUser.id
  const email = sessionUser.email ?? undefined

const session = sessionUser ? { user: sessionUser } : null

  let appUser = null
  let dbUnavailable = false

  try {
    const lookupStartedAt = performance.now()
    appUser = await prisma.user.findUnique({
      where: { authId },
      select: {
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
      },
    })
    logTiming('prisma.user.findUnique', lookupStartedAt)

    logTiming('prisma.user.findUnique', lookupStartedAt)

    if (!appUser && email) {
      const emailLookupStartedAt = performance.now()
      const userByEmail = await prisma.user.findUnique({
        where: { email },
        select: {
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
        },
      })

        logTiming('prisma.user.findUnique(email)', emailLookupStartedAt)

      if (userByEmail) {
        const updateStartedAt = performance.now()
        await prisma.user.update({
          where: { id: userByEmail.id },
          data: { authId },
        })
logTiming('prisma.user.update.authId', updateStartedAt)
        appUser = userByEmail
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
})

export async function getCurrentAppUser() {
  return withRequestMetrics('auth/getCurrentAppUser', () => loadCurrentUser())
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
