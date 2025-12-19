// src/app/api/session/bootstrap/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { User } from '@supabase/supabase-js'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  appUserSelect,
  getCurrentAppUserFromSessionUser,
  type SelectedAppUser,
} from '@/lib/auth'
import { withRequestMetrics } from '@/lib/request-metrics'
function isDbUnavailableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P1001' || error.code === 'P1002'))
  )
}

async function syncUser(sessionUser: User | null): Promise<SelectedAppUser | null> {
  if (!sessionUser) return null

  const authId = sessionUser.id as string
  const email = (sessionUser.email ?? '') as string
  const name = ((sessionUser.user_metadata as any)?.name ?? '') as string

  try {
    const existing = await prisma.user.findUnique({
      where: { authId },
      select: appUserSelect,
    })

    if (existing) return existing

    if (email) {
      const byEmail = await prisma.user.findUnique({
        where: { email },
        select: appUserSelect,
      })

      if (byEmail) {
        return prisma.user.update({
          where: { id: byEmail.id },
          data: { authId },
          select: appUserSelect,
        })
      }
    }

    return prisma.user.create({
      data: {
        authId,
        email,
        fullName: name || email,
        status: 'ATIVO',
      },
      select: appUserSelect,
    })
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

    const { data, error } = await supabase.auth.getUser()

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

    let syncedUser: SelectedAppUser | null = null

    try {
      syncedUser = await syncUser(sessionUser)
    } catch (err) {
      const isDbUnavailable = isDbUnavailableError(err)
      console.error('Erro ao sincronizar usuário no bootstrap', err)

      return NextResponse.json(
        {
          error: 'Falha ao sincronizar usuário',
          dbUnavailable: isDbUnavailable,
        },
        { status: isDbUnavailable ? 503 : 500 },
      )
    }

    try {
      const { appUser, session, dbUnavailable } = await getCurrentAppUserFromSessionUser(
        sessionUser,
        syncedUser,
      )
 if (!appUser) {
        return NextResponse.json(
          {
            error: 'Usuário não encontrado no banco',
            dbUnavailable,
          },
          { status: dbUnavailable ? 503 : 404 },
        )
      }

      return NextResponse.json({
        appUser,
        session,
        dbUnavailable,
      })
    } catch (err) {
      const isDbUnavailable = isDbUnavailableError(err)
      console.error('Erro ao carregar appUser a partir da sessão', err)

      return NextResponse.json(
        {
          error: 'Erro ao carregar usuário autenticado',
          dbUnavailable: isDbUnavailable,
        },
        { status: isDbUnavailable ? 503 : 500 },
      )
    }
  })
}