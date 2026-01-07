import { NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/auth'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'
import { TI_EQUIPMENT_CATEGORIES } from '@/lib/tiEquipment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function canViewAnyCategory(userId: string) {
  const checks = await Promise.all(
    TI_EQUIPMENT_CATEGORIES.map((category) =>
      canFeature(userId, MODULE_KEYS.EQUIPAMENTOS_TI, category.featureKey, Action.VIEW),
    ),
  )

  return checks.some(Boolean)
}

export async function GET(req: Request) {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  if (!(await canViewAnyCategory(appUser.id))) {
    return NextResponse.json({ error: 'Acesso negado aos equipamentos TI.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim() ?? ''

  if (!search) {
    return NextResponse.json([])
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
      status: 'ATIVO',
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      costCenter: { select: { id: true, description: true, externalCode: true, code: true } },
    },
    orderBy: { fullName: 'asc' },
    take: 10,
  })

  return NextResponse.json(users)
}