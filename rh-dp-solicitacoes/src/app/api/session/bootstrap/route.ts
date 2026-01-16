// src/app/api/session/bootstrap/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { User } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import {
  appUserSelect,
  getCurrentAppUserFromSessionUser,
  type SelectedAppUser,
} from '@/lib/auth'
import { isDbUnavailableError } from '@/lib/db-unavailable'
import { logTiming, withRequestMetrics } from '@/lib/request-metrics'

const isDbDisabled = process.env.SKIP_PRISMA_DB === 'true'
async function syncUser(sessionUser: User | null): Promise<SelectedAppUser | null> {
  if (!sessionUser) return null

  const authId = sessionUser.id as string
  const email = (sessionUser.email ?? '') as string
  const name = ((sessionUser.user_metadata as any)?.name ?? '') as string

  try {
    const lookupStartedAt = performance.now()
    const existing = await prisma.user.findUnique({
      where: { authId },
      select: appUserSelect,
    })
    logTiming('prisma.user.findUnique (bootstrap)', lookupStartedAt)

    if (existing) return existing

    if (email) {
      const byEmailStartedAt = performance.now()
      const byEmail = await prisma.user.findUnique({
        where: { email },
        select: appUserSelect,
      })
      logTiming('prisma.user.findUnique(email) (bootstrap)', byEmailStartedAt)

      if (byEmail) {
        const updateStartedAt = performance.now()
        const updated = await prisma.user.update({
          where: { id: byEmail.id },
          data: { authId },
          select: appUserSelect,
        })
        logTiming('prisma.user.update.authId (bootstrap)', updateStartedAt)
        return updated
      }
    }

    const createStartedAt = performance.now()
    const created = await prisma.user.create({
      data: {
        authId,
        email,
        fullName: name || email,
        status: 'ATIVO',
      },
      select: appUserSelect,
    })
    logTiming('prisma.user.create (bootstrap)', createStartedAt)
    return created
  } catch (error) {
    if (isDbUnavailableError(error)) {
      console.error(
        'Não foi possível conectar ao banco de dados para sincronizar usuário',
        error,
      )
      throw error
    }

    console.error('Erro ao sincronizar usuário no banco de dados', error)
    throw error
  }
}

export async function GET() {
  return withRequestMetrics('GET /api/session/bootstrap', async () => {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const authStartedAt = performance.now()
    const { data, error } = await supabase.auth.getUser()
    logTiming('supabase.auth.getUser (/api/session/bootstrap)', authStartedAt)

    if (error || !data?.user) {
      if (error) {
        console.error('Erro ao buscar usuário autenticado', error)
      }

      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 },
      )
    }

    const sessionUser = data.user
    if (isDbDisabled) {
      const requestId = crypto.randomUUID()
      console.warn('Banco de dados desabilitado no bootstrap', { requestId })
      return NextResponse.json(
        {
          error: 'Banco de dados desabilitado neste ambiente (SKIP_PRISMA_DB=true).',
          dbUnavailable: true,
          requestId,
        },
        { status: 503 },
      )
    }

    let syncedUser: SelectedAppUser | null = null

    try {
      const syncStartedAt = performance.now()
      syncedUser = await syncUser(sessionUser)
      logTiming('prisma.user.sync (/api/session/bootstrap)', syncStartedAt)
    } catch (err) {
      const isDbUnavailable = isDbUnavailableError(err)
      const requestId = crypto.randomUUID()
      console.error('Erro ao sincronizar usuário no bootstrap', { requestId, err })

      return NextResponse.json(
        {
          error: 'Falha ao sincronizar usuário',
          dbUnavailable: isDbUnavailable,
          requestId,
        },
        { status: isDbUnavailable ? 503 : 500 },
      )
    }
    try {
      const lookupStartedAt = performance.now()
      const { appUser, session, dbUnavailable } = await getCurrentAppUserFromSessionUser(
        sessionUser,
        syncedUser,
      )
      logTiming('prisma.user.resolve (/api/session/bootstrap)', lookupStartedAt)
      if (!appUser) {
        return NextResponse.json(
          {
            error: 'Usuário não encontrado no banco',
            dbUnavailable,
          },
          { status: dbUnavailable ? 503 : 404 },
        )
      }

      return NextResponse.json(
        {
          appUser,
          session,
          dbUnavailable,
        },
        {
          headers: {
            'Cache-Control': 'private, max-age=15, stale-while-revalidate=30',
          },
        },
      )
    } catch (err) {
      const isDbUnavailable = isDbUnavailableError(err)
      const requestId = crypto.randomUUID()
      console.error('Erro ao carregar appUser a partir da sessão', { requestId, err })

      return NextResponse.json(
        {
          error: 'Erro ao carregar usuário autenticado',
          dbUnavailable: isDbUnavailable,
          requestId,
        },
        { status: isDbUnavailable ? 503 : 500 },
      )
    }
  })
}