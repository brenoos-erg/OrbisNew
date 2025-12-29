import { NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
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

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso a este módulo.' }, { status: 403 })
    }

    const report = await prisma.refusalReport.findUnique({
      where: { id: params.id },
      include: { attachments: true },
    })

    if (!report) {
      return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
    }

    const isReviewer = hasMinLevel(level, ModuleLevel.NIVEL_2)
     const isLevel3 = level === ModuleLevel.NIVEL_3
    const isResponsible =
      report.contractManagerId === me.id || report.generalCoordinatorId === me.id
    if (!isReviewer && report.employeeId !== me.id) {
      return NextResponse.json({ error: 'Usuário não possui permissão para visualizar este registro.' }, { status: 403 })
    }

    if (isReviewer && !isLevel3 && !isResponsible && report.employeeId !== me.id) {
      return NextResponse.json({ error: 'Usuário não possui permissão para visualizar este registro.' }, { status: 403 })
    }


    return NextResponse.json({
      report,
    })
  } catch (e) {
    console.error('GET /api/direito-de-recusa/[id] error', e)
    return NextResponse.json(
      { error: 'Erro ao carregar o registro de direito de recusa.' },
      { status: 500 },
    )
  }
}
