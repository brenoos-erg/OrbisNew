import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, RefusalStatus, UserStatus } from '@prisma/client'
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

    if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      return NextResponse.json({ error: 'Usuário não possui acesso a este módulo.' }, { status: 403 })
    }

    const isReviewer = hasMinLevel(level, ModuleLevel.NIVEL_2)
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

    return NextResponse.json({ reports, canReview: true })
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
      !detailedCondition
    ) {
      return NextResponse.json(
        { error: 'Preencha todos os campos obrigatórios.' },
        { status: 400 },
      )
    }
    const contractManager = contractManagerId
      ? await prisma.userModuleAccess.findFirst({
          where: {
            userId: contractManagerId,
            module: { key: { in: ['DIREITO-DE-RECUSA', 'direito-de-recusa', 'direito_de_recusa'] } },
            level: { in: [ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3] },
            user: { status: UserStatus.ATIVO },
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
            module: { key: { in: ['DIREITO-DE-RECUSA', 'direito-de-recusa', 'direito_de_recusa'] } },
            level: ModuleLevel.NIVEL_3,
            user: { status: UserStatus.ATIVO },
          },
          select: { user: { select: { id: true, fullName: true } } },
        })
      : null

    if (generalCoordinatorId && !generalCoordinator) {
      return NextResponse.json(
        { error: 'Coordenador geral (Nível 3) inválido ou inativo.' },
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
