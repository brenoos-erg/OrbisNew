export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUserFromRouteHandler } from '@/lib/auth-route'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'
import { TI_EQUIPMENT_CATEGORIES } from '@/lib/tiEquipment'

export const runtime = 'nodejs'

async function canViewAnyCategory(userId: string) {
  const checks = await Promise.all(
    TI_EQUIPMENT_CATEGORIES.map((category) =>
      canFeature(userId, MODULE_KEYS.EQUIPAMENTOS_TI, category.featureKey, Action.VIEW),
    ),
  )

  return checks.some(Boolean)
}

export async function GET(req: Request) {
  const { appUser, requestId, dbUnavailable } = await getCurrentAppUserFromRouteHandler()

  if (!appUser) {
    console.warn('[ti/equipamentos/users][GET] Não autenticado', { requestId })
    if (dbUnavailable) {
      return NextResponse.json(
        { error: 'Banco de dados indisponível no momento.', dbUnavailable: true, requestId },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Não autenticado', requestId }, { status: 401 })
  }

  if (!(await canViewAnyCategory(appUser.id))) {
    return NextResponse.json(
      { error: 'Acesso negado aos equipamentos TI.', requestId },
      { status: 403 },
    )
  }

 try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() ?? ''
    const limitParam = Number.parseInt(searchParams.get('limit') ?? '10', 10)
    const limit = Number.isFinite(limitParam) ? Math.min(50, Math.max(5, limitParam)) : 10

    const users = await prisma.user.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { fullName: { contains: search } },
                { email: { contains: search } },
              ],
            }
          : {}),
        status: 'ATIVO',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        costCenter: { select: { id: true, description: true, externalCode: true, code: true } },
      },
      orderBy: { fullName: 'asc' },
      take: limit,
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('[ti/equipamentos/users][GET] Falha ao buscar usuários', {
      requestId,
      error,
    })
    return NextResponse.json(
      { error: 'Falha ao buscar usuários.', requestId },
      { status: 500 },
    )
  }
}
