export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, RefusalStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'

const MODULE_KEY = 'direito-de-recusa'
const LEVEL_ORDER: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

function hasMinLevel(level: ModuleLevel | undefined, min: ModuleLevel) {
  if (!level) return false
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(min)
}

function normalizeLevel(levels: Record<string, ModuleLevel | undefined>) {
  return levels[MODULE_KEY] ?? levels[MODULE_KEY.replace(/-/g, '_')]
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      return NextResponse.json({ error: 'Apenas gestores ou SST podem decidir.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const { decision, comment } = body as { decision?: boolean; comment?: string }

    if (typeof decision !== 'boolean') {
      return NextResponse.json({ error: 'Informe a decisão (sim/não).' }, { status: 400 })
    }

    const report = await prisma.refusalReport.findUnique({
      where: { id: params.id },
    })

    if (!report) {
      return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
    }

    if (report.status !== RefusalStatus.PENDENTE) {
      return NextResponse.json(
        { error: 'Este registro já foi decidido.' },
        { status: 400 },
      )
    }
    const isLevel3 = level === ModuleLevel.NIVEL_3
    const isResponsible =
      report.contractManagerId === me.id || report.generalCoordinatorId === me.id

    if (!isLevel3 && !isResponsible) {
      return NextResponse.json(
        { error: 'Apenas gestores responsáveis podem registrar a decisão.' },
        { status: 403 },
      )
    }

    const updated = await prisma.refusalReport.update({
      where: { id: report.id },
      data: {
        status: decision ? RefusalStatus.APROVADA : RefusalStatus.REJEITADA,
        decision,
        decisionComment: comment?.trim() || null,
        decidedAt: new Date(),
        decidedById: me.id,
        decisionLevel: level,
      },
    })

    return NextResponse.json({ report: updated })
  } catch (e) {
    console.error('PATCH /api/direito-de-recusa/[id]/decisao error', e)
    return NextResponse.json(
      { error: 'Erro ao registrar a decisão.' },
      { status: 500 },
    )
  }
}