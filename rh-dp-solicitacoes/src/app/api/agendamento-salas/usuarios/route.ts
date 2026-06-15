export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { Action, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUserFromRouteHandler } from '@/lib/auth-route'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'

export async function GET(req: Request) {
  const { appUser, requestId, dbUnavailable } = await getCurrentAppUserFromRouteHandler()
  if (!appUser) {
    return NextResponse.json(
      dbUnavailable
        ? { error: 'Banco de dados indisponível no momento.', dbUnavailable: true, requestId }
        : { error: 'Não autenticado', requestId },
      { status: dbUnavailable ? 503 : 401 },
    )
  }

  const allowed = await canFeature(appUser.id, MODULE_KEYS.AGENDAMENTO_SALAS, FEATURE_KEYS.AGENDAMENTO_SALAS.MARCAR, Action.CREATE)
  if (!allowed) return NextResponse.json({ error: 'Acesso negado ao agendamento de salas.', requestId }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') ?? '').trim()
  const where: Prisma.UserWhereInput = {
    status: 'ATIVO',
    ...(search
      ? {
          OR: [
            { fullName: { contains: search } },
            { email: { contains: search } },
            { login: { contains: search } },
          ],
        }
      : {}),
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { fullName: 'asc' },
    take: 50,
    select: {
      id: true,
      fullName: true,
      email: true,
      login: true,
      phone: true,
      costCenter: { select: { description: true, code: true, externalCode: true } },
    },
  })

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      login: user.login,
      phone: user.phone,
      costCenterName: user.costCenter
        ? `${user.costCenter.externalCode || user.costCenter.code || ''}${user.costCenter.externalCode || user.costCenter.code ? ' - ' : ''}${user.costCenter.description}`
        : null,
    })),
  })
}
