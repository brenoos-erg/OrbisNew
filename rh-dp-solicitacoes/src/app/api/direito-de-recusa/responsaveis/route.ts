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

    const moduleRecord = await prisma.module.findFirst({
      where: { key: { in: ['DIREITO-DE-RECUSA', 'direito-de-recusa', 'direito_de_recusa'] } },
      select: { id: true },
    })

    if (!moduleRecord) {
      return NextResponse.json({ error: 'Módulo não configurado.' }, { status: 500 })
    }

    const responsibles = await prisma.userModuleAccess.findMany({
      where: {
        moduleId: moduleRecord.id,
        level: { in: [ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3] },
        user: { status: UserStatus.ATIVO },
      },
      select: {
        level: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ level: 'asc' }, { user: { fullName: 'asc' } }],
    })

    return NextResponse.json({
      responsibles: responsibles.map((r) => ({
        id: r.user.id,
        name: r.user.fullName,
        email: r.user.email,
        department: r.user.department?.name ?? null,
        level: r.level,
      })),
    })
  } catch (e) {
    console.error('GET /api/direito-de-recusa/responsaveis error', e)
    return NextResponse.json({ error: 'Erro ao carregar responsáveis.' }, { status: 500 })
  }
}