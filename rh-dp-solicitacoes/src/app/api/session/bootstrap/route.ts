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
    if (error instanceof Prisma.PrismaClientInitializationError) {
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

    if (error) {
      console.error('Erro ao buscar usuário autenticado', error)
    }

    const sessionUser = data?.user ?? null

    let syncedUser: SelectedAppUser | null = null
    let dbUnavailable = false

    if (sessionUser) {
      try {
        syncedUser = await syncUser(sessionUser)
      } catch (err) {
        if (err instanceof Prisma.PrismaClientInitializationError) {
          dbUnavailable = true
        }
      }
    }

    const { appUser, session, dbUnavailable: authDbUnavailable } =
      await getCurrentAppUserFromSessionUser(sessionUser, syncedUser)

    return NextResponse.json({
      appUser,
      session,
      dbUnavailable: dbUnavailable || authDbUnavailable,
    })
  })
}