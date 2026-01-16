
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, RefusalStatus, UserStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { prisma } from '@/lib/prisma'
import { performance } from 'node:perf_hooks'
import { logTiming, withRequestMetrics } from '@/lib/request-metrics'

const MODULE_KEY = 'direito-de-recusa'
const MODULE_KEY_VARIANTS = ['DIREITO-DE-RECUSA', 'direito-de-recusa', 'direito_de_recusa']
const LEVEL_ORDER: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

function hasMinLevel(level: ModuleLevel | undefined, min: ModuleLevel) {
  if (!level) return false
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(min)
}

function normalizeLevel(levels: Record<string, ModuleLevel | undefined>) {
  return levels[MODULE_KEY] ?? levels[MODULE_KEY.replace(/-/g, '_')]
}

export async function GET(req: NextRequest) {
  return withRequestMetrics('GET /api/direito-de-recusa', async () => {
    try {
      const me = await requireActiveUser()
      const { levels } = await getUserModuleContext(me.id)
      const level = normalizeLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      return NextResponse.json({ error: 'Usuário não possui acesso a este módulo.' }, { status: 403 })
    }

    const isLevel3 = hasMinLevel(level, ModuleLevel.NIVEL_3)
    const canReview = hasMinLevel(level, ModuleLevel.NIVEL_2)
    const { searchParams } = new URL(req.url)
    const statusParam = searchParams.get('status')

    const where: any = {}
    if (!isLevel3) {
      where.OR = [
        { contractManagerId: me.id },
        { generalCoordinatorId: me.id },
      ]
    }
    if (statusParam && Object.values(RefusalStatus).includes(statusParam as RefusalStatus)) {
      where.status = statusParam as RefusalStatus
    }

    const listStartedAt = performance.now()
      const reports = await prisma.refusalReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        status: true,
        riskSituation: true,
        sectorOrContract: true,
        contractManagerId: true,
        contractManagerName: true,
        generalCoordinatorId: true,
        generalCoordinatorName: true,
        employeeName: true,
        employeeId: true,
        decision: true,
        decisionComment: true,
        decidedAt: true,
        decisionLevel: true,
      },
     })
      logTiming('prisma.refusalReport.list (/api/direito-de-recusa)', listStartedAt)

      return NextResponse.json({ reports, canReview })
    } catch (e) {
      console.error('GET /api/direito-de-recusa error', e)
      return NextResponse.json(
        { error: 'Erro ao carregar os registros de Direito de Recusa.' },
        { status: 500 },
      )
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso a este módulo.' }, { status: 403 })
    }
    if (!me.departmentId) {
      return NextResponse.json(
        { error: 'Associe-se a um departamento para registrar uma recusa.' },
        { status: 400 },
      )
    }

    const body = await req.json().catch(() => ({} as any))
    const {
      contractManagerId,
      generalCoordinatorId,
      contractManagerName,
      generalCoordinatorName,
      sectorOrContract,
      riskSituation,
      locationOrEquipment,
      detailedCondition,
    } = body as {
      contractManagerId?: string | null
      generalCoordinatorId?: string | null
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
        !detailedCondition ||
      !contractManagerId ||
      !generalCoordinatorId
    ) {
       return NextResponse.json(
        { error: 'Preencha todos os campos obrigatórios, incluindo responsáveis.' },
        { status: 400 },
      )
    }
    const contractManager = contractManagerId
      ? await prisma.userModuleAccess.findFirst({
          where: {
            userId: contractManagerId,
            module: { key: { in: MODULE_KEY_VARIANTS } },
            level: ModuleLevel.NIVEL_2,
            user: { status: UserStatus.ATIVO, departmentId: me.departmentId },
          },
          select: { user: { select: { id: true, fullName: true } } },
        })
      : null

    if (contractManagerId && !contractManager) {
      return NextResponse.json(
        { error: 'Gestor de contrato (Nível 2) inválido ou inativo.' },
        { status: 400 },
      )
    }

    const generalCoordinator = generalCoordinatorId
      ? await prisma.userModuleAccess.findFirst({
          where: {
            userId: generalCoordinatorId,
            module: { key: { in: MODULE_KEY_VARIANTS } },
            level: ModuleLevel.NIVEL_3,
            user: { status: UserStatus.ATIVO, departmentId: me.departmentId },
          },
          select: { user: { select: { id: true, fullName: true } } },
        })
      : null

    if (generalCoordinatorId && !generalCoordinator) {
      return NextResponse.json(
        { error: 'Coordenador geral inválido ou inativo.' },
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
        contractManagerId: contractManager?.user.id ?? null,
        contractManagerName: contractManager?.user.fullName ?? contractManagerName?.trim() ?? null,
        generalCoordinatorId: generalCoordinator?.user.id ?? null,
        generalCoordinatorName: generalCoordinator?.user.fullName ?? generalCoordinatorName?.trim() ?? null,
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
