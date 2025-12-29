import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, RefusalStatus } from '@prisma/client'
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

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso a este módulo.' }, { status: 403 })
    }

    const isReviewer = hasMinLevel(level, ModuleLevel.NIVEL_2)
    const { searchParams } = new URL(req.url)
    const statusParam = searchParams.get('status')

    const where: any = {}
    if (!isReviewer) {
      where.employeeId = me.id
    }
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
        employeeName: true,
        employeeId: true,
        decision: true,
        decisionComment: true,
        decidedAt: true,
        decisionLevel: true,
      },
    })

    return NextResponse.json({ reports, canReview: isReviewer })
  } catch (e) {
    console.error('GET /api/direito-de-recusa error', e)
    return NextResponse.json(
      { error: 'Erro ao carregar os registros de Direito de Recusa.' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso a este módulo.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const {
      contractManagerName,
      generalCoordinatorName,
      sectorOrContract,
      riskSituation,
      locationOrEquipment,
      detailedCondition,
    } = body as {
      contractManagerName?: string
      generalCoordinatorName?: string
      sectorOrContract?: string
      riskSituation?: string
      locationOrEquipment?: string
      detailedCondition?: string
    }

    if (
      !sectorOrContract ||
      !riskSituation ||
      !locationOrEquipment ||
      !detailedCondition
    ) {
      return NextResponse.json(
        { error: 'Preencha todos os campos obrigatórios.' },
        { status: 400 },
      )
    }

    const report = await prisma.refusalReport.create({
      data: {
        employeeId: me.id,
        employeeName: me.fullName,
        sectorOrContract: sectorOrContract.trim(),
        riskSituation: riskSituation.trim(),
        locationOrEquipment: locationOrEquipment.trim(),
        detailedCondition: detailedCondition.trim(),
        contractManagerName: contractManagerName?.trim() || null,
        generalCoordinatorName: generalCoordinatorName?.trim() || null,
        status: RefusalStatus.PENDENTE,
      },
      select: { id: true },
    })

    return NextResponse.json({ id: report.id })
  } catch (e) {
    console.error('POST /api/direito-de-recusa error', e)
    return NextResponse.json(
      { error: 'Erro ao registrar o direito de recusa.' },
      { status: 500 },
    )
  }
}
