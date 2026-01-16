export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, RefusalStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { prisma } from '@/lib/prisma'


const MODULE_KEY = 'direito-de-recusa'
const LEVEL_ORDER: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

function hasMinLevel(level: ModuleLevel | undefined, min: ModuleLevel) {
  if (!level) return false
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(min)
}

function normalizeLevel(levels: Record<string, ModuleLevel | undefined>) {
  return levels[MODULE_KEY] ?? levels[MODULE_KEY.replace(/-/g, '_')]
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso a este módulo.' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const statusParam = searchParams.get('status')

    const where: any = { employeeId: me.id }
    if (statusParam && Object.values(RefusalStatus).includes(statusParam as RefusalStatus)) {
      where.status = statusParam as RefusalStatus
    }

    const reports = await prisma.refusalReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        status: true,
        riskSituation: true,
        sectorOrContract: true,
        contractManagerName: true,
        generalCoordinatorName: true,
        decision: true,
        decisionComment: true,
        decidedAt: true,
        decisionLevel: true,
      },
    })

    return NextResponse.json({ reports })
  } catch (e) {
    console.error('GET /api/direito-de-recusa/minhas error', e)
    return NextResponse.json(
      { error: 'Erro ao carregar seus direitos de recusa.' },
      { status: 500 },
    )
  }
}