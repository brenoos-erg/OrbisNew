import {
  Action,
  ModuleLevel,
  NonConformityActionPlanOrigin,
  NonConformityActionStatus,
  QualityActionPlanStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'

export async function ensurePlanAccess(action: Action) {
  const me = await requireActiveUser()
  const { levels } = await getUserModuleContext(me.id)
  const level = normalizeSstLevel(levels)

  if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
    throw new Error('NO_ACCESS')
  }

  await assertCanFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.PLANO_DE_ACAO, action)
  return me
}

export function toDate(value: unknown) {
  if (value === undefined) return undefined
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export function toOptionalString(value: unknown) {
  if (value === undefined) return undefined
  const parsed = String(value || '').trim()
  return parsed || null
}

export function toOptionalNumber(value: unknown, min?: number, max?: number) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  if (min !== undefined && parsed < min) return undefined
  if (max !== undefined && parsed > max) return undefined
  return parsed
}

export function toOptionalDecimal(value: unknown) {
  return toOptionalNumber(value)
}

export function normalizeEvidenceText(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return null

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n') || null
}

export function isOverdue(action: { prazo: Date | null; dataConclusao: Date | null; status: NonConformityActionStatus }) {
  if (!action.prazo || action.dataConclusao) return false
  if (action.status === NonConformityActionStatus.CONCLUIDA || action.status === NonConformityActionStatus.CANCELADA) return false

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const prazo = new Date(action.prazo.getFullYear(), action.prazo.getMonth(), action.prazo.getDate())
  return prazo < today
}

export function summarizeActions(actions: { status: NonConformityActionStatus; prazo: Date | null; dataConclusao: Date | null }[]) {
  const totalAcoes = actions.length
  const acoesConcluidas = actions.filter((action) => action.status === NonConformityActionStatus.CONCLUIDA).length
  const acoesPendentes = actions.filter((action) => action.status === NonConformityActionStatus.PENDENTE).length
  const acoesEmAndamento = actions.filter((action) => action.status === NonConformityActionStatus.EM_ANDAMENTO).length
  const acoesCanceladas = actions.filter((action) => action.status === NonConformityActionStatus.CANCELADA).length
  const acoesEmAtraso = actions.filter(isOverdue).length
  const percentualConcluido = totalAcoes ? Math.round((acoesConcluidas / totalAcoes) * 100) : 0

  return {
    totalAcoes,
    acoesConcluidas,
    acoesPendentes,
    acoesEmAndamento,
    acoesCanceladas,
    acoesEmAtraso,
    percentualConcluido,
  }
}

export function consolidatedStatus(actions: { status: NonConformityActionStatus }[], fallback: QualityActionPlanStatus) {
  if (!actions.length) return fallback
  if (actions.every((action) => action.status === NonConformityActionStatus.CONCLUIDA)) return QualityActionPlanStatus.CONCLUIDO
  if (actions.every((action) => action.status === NonConformityActionStatus.CANCELADA)) return QualityActionPlanStatus.CANCELADO
  if (actions.some((action) => action.status === NonConformityActionStatus.EM_ANDAMENTO)) return QualityActionPlanStatus.EM_ANDAMENTO
  return QualityActionPlanStatus.ABERTO
}

export function serializePlan(plan: any) {
  const summary = summarizeActions(plan.actions || [])

  return {
    ...plan,
    actions: undefined,
    statusConsolidado: consolidatedStatus(plan.actions || [], plan.status),
    ...summary,
  }
}

export async function nextPlanNumber(tx: any = prisma) {
  const year = new Date().getFullYear()

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const seq = await tx.qualityActionPlanSequence.upsert({
      where: { year },
      create: { year, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
    })
    const numeroPlano = `PA-${year}-${String(seq.lastValue).padStart(4, '0')}`
    const existing = await tx.qualityActionPlan.findUnique({ where: { numeroPlano }, select: { id: true } })
    if (!existing) return numeroPlano
  }

  throw new Error('Não foi possível gerar número único para o plano de ação.')
}

export async function createLegacyPlanForAction(actionId: string, userId?: string) {
  const action = await prisma.nonConformityActionItem.findUnique({ where: { id: actionId } })
  if (!action || action.nonConformityId) return null
  if (action.qualityActionPlanId) return action.qualityActionPlanId

  const referenceLooksLikePlan = Boolean(action.referencia && /^(PA|PAV)[-_]?\d{4}/i.test(action.referencia))
  const numeroPlano = referenceLooksLikePlan ? action.referencia! : await nextPlanNumber()

  const plan = await prisma.qualityActionPlan.upsert({
    where: { numeroPlano },
    create: {
      numeroPlano,
      titulo: `${referenceLooksLikePlan ? action.referencia : 'Plano avulso legado'} - ${action.descricao}`.slice(0, 191),
      origem: action.origem,
      referencia: action.referencia,
      status: action.status === NonConformityActionStatus.CONCLUIDA
        ? QualityActionPlanStatus.CONCLUIDO
        : action.status === NonConformityActionStatus.CANCELADA
          ? QualityActionPlanStatus.CANCELADO
          : action.status === NonConformityActionStatus.EM_ANDAMENTO
            ? QualityActionPlanStatus.EM_ANDAMENTO
            : QualityActionPlanStatus.ABERTO,
      createdById: action.createdById || userId || null,
      responsavelId: action.responsavelId,
      responsavelNome: action.responsavelNome,
      centroResponsavelId: action.centroResponsavelId,
      centroImpactadoId: action.centroImpactadoId,
      dataInicioPrevista: action.dataInicioPrevista,
      dataFimPrevista: action.dataFimPrevista,
      dataConclusao: action.dataConclusao,
    },
    update: {},
    select: { id: true },
  })

  await prisma.nonConformityActionItem.updateMany({
    where: referenceLooksLikePlan
      ? { nonConformityId: null, origemPlano: NonConformityActionPlanOrigin.PLANO_AVULSO, referencia: action.referencia, qualityActionPlanId: null }
      : { id: action.id, qualityActionPlanId: null },
    data: { qualityActionPlanId: plan.id, origemPlano: NonConformityActionPlanOrigin.PLANO_AVULSO },
  })

  return plan.id
}
