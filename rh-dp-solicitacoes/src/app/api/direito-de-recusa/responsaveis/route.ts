import { NextResponse } from 'next/server'
import { ModuleLevel, UserStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'

export const dynamic = 'force-dynamic'

const MODULE_KEY = 'direito-de-recusa'
const LEVEL_ORDER: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

function hasMinLevel(level: ModuleLevel | undefined, min: ModuleLevel) {
  if (!level) return false
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(min)
}

function normalizeLevel(levels: Record<string, ModuleLevel | undefined>) {
  return levels[MODULE_KEY] ?? levels[MODULE_KEY.replace(/-/g, '_')]
}

export async function GET() {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso a este módulo.' }, { status: 403 })
    }

    const responsibles = await prisma.user.findMany({
      where: {
        status: UserStatus.ATIVO,
        moduleAccesses: { some: { level: ModuleLevel.NIVEL_3 } },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        department: { select: { name: true } },
      },
      orderBy: [{ fullName: 'asc' }],
    })

    return NextResponse.json({
      responsibles: responsibles.map((user) => ({
        id: user.id,
        name: user.fullName,
        email: user.email,
        department: user.department?.name ?? null,
        level: ModuleLevel.NIVEL_3,
      })),
    })
  } catch (e) {
    console.error('GET /api/direito-de-recusa/responsaveis error', e)
    return NextResponse.json({ error: 'Erro ao carregar responsáveis.' }, { status: 500 })
  }
}