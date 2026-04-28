import { NextRequest, NextResponse } from 'next/server'
import { Action, ModuleLevel, NonConformityActionPlanOrigin, NonConformityActionStatus, NonConformityActionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'
import { canManageAllNc } from '@/lib/sst/nonConformity'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'
import { canUserTreatNc, getUserCostCenterIds } from '@/lib/sst/nonConformityAccess'
import { resolveAutomaticActionStatus } from '@/lib/sst/actionStatusAutomation'
import { notifyNonConformityStakeholders } from '@/lib/sst/nonConformityNotifications'

async function assertEditable(id: string, userId: string, level: ModuleLevel | undefined) {
  const nc = await prisma.nonConformity.findUnique({
    where: { id },
    select: {
      solicitanteId: true,
      aprovadoQualidadeStatus: true,
      centroQueDetectouId: true,
      centroQueOriginouId: true,
    },
  })  
   if (!nc) return { error: 'Não conformidade não encontrada.', status: 404 }
  if (nc.aprovadoQualidadeStatus !== 'APROVADO' && !canManageAllNc(level)) {
    return { error: 'Plano de ação só pode ser alterado após aprovação da qualidade.', status: 403 }
  }
  const userCostCenterIds = hasMinLevel(level, ModuleLevel.NIVEL_2) ? [] : await getUserCostCenterIds(userId)
  const canTreat = canUserTreatNc({
    userId,
    level,
    ncSolicitanteId: nc.solicitanteId,
    centroQueDetectouId: nc.centroQueDetectouId,
    centroQueOriginouId: nc.centroQueOriginouId,
    userCostCenterIds,
  })
  if (!canTreat) return { error: 'Sem permissão para esta NC.', status: 403 }

  return null
}

function toDate(value: unknown) {
  if (value === undefined) return undefined
  if (!value) return null
  return new Date(String(value))
}

function toOptionalString(value: unknown) {
  if (value === undefined) return undefined
  const parsed = String(value || '').trim()
  return parsed || null
}

function toOptionalIntBetween(value: unknown, min = 1, max = 5) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return undefined
  return parsed
}

function toOptionalDecimal(value: unknown) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return parsed
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Nível SST inválido.' }, { status: 403 })
    }
    await assertCanFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.PLANO_DE_ACAO, Action.CREATE)

    const id = (await params).id
    const blocked = await assertEditable(id, me.id, level)
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })

      const body = await req.json().catch(() => ({} as any))
    const descricao = String(body?.descricao || '').trim()
    if (!descricao) return NextResponse.json({ error: 'Descrição é obrigatória.' }, { status: 400 })

  const row = await prisma.$transaction(async (tx) => {
      const dataInicioPrevista = toDate(body?.dataInicioPrevista)
      const dataFimPrevista = toDate(body?.dataFimPrevista)
      const prazo = body?.prazo ? new Date(body.prazo) : null
      const dataConclusao = toDate(body?.dataConclusao)
      const status = resolveAutomaticActionStatus({
        requestedStatus: body?.status,
        prazo,
        dataInicioPrevista,
        dataConclusao,
      })

      const created = await tx.nonConformityActionItem.create({
        data: {
          nonConformityId: id,
          origemPlano: NonConformityActionPlanOrigin.NAO_CONFORMIDADE,
          createdById: me.id,
          descricao,
          motivoBeneficio: toOptionalString(body?.motivoBeneficio),
          atividadeComo: toOptionalString(body?.atividadeComo),
          centroImpactadoId: body?.centroImpactadoId ? String(body.centroImpactadoId) : null,
          centroImpactadoDescricao: toOptionalString(body?.centroImpactadoDescricao),
          centroResponsavelId: body?.centroResponsavelId ? String(body.centroResponsavelId) : null,
          dataInicioPrevista,
          dataFimPrevista,
          custo: toOptionalDecimal(body?.custo),
          dataConclusao,
          tipo: Object.values(NonConformityActionType).includes(body?.tipo) ? body.tipo : NonConformityActionType.ACAO_CORRETIVA,
          origem: toOptionalString(body?.origem) ?? 'NÃO CONFORMIDADE',
          referencia: toOptionalString(body?.referencia),
          rapidez: toOptionalIntBetween(body?.rapidez),
          autonomia: toOptionalIntBetween(body?.autonomia),
          beneficio: toOptionalIntBetween(body?.beneficio),
          responsavelId: body?.responsavelId ? String(body.responsavelId) : null,
          responsavelNome: body?.responsavelNome ? String(body.responsavelNome).trim() : null,
          prazo,
          status,
          evidencias: body?.evidencias ? String(body.evidencias).trim() : null,
        },
      })

      await appendNonConformityTimelineEvent(tx, {
        nonConformityId: id,
        actorId: me.id,
        tipo: 'PLANO_ACAO',
        message: `Ação ${created.id} criada no plano de ação (${created.status})${created.descricao ? ` - ${created.descricao}` : ''}`,
      })
      return created
    })

    const createNotification = await notifyNonConformityStakeholders({
      nonConformityId: id,
      actorId: me.id,
      event: 'ACTION_PLAN_CREATED',
      actionItemId: row.id,
    })
    if (!createNotification.sent) {
      console.warn('NC action plan creation notification not sent', {
        nonConformityId: id,
        actionItemId: row.id,
        reason: createNotification.reason,
      })
    }

    if (row.responsavelId) {
      const assignedNotification = await notifyNonConformityStakeholders({
        nonConformityId: id,
        actorId: me.id,
        event: 'ACTION_ITEM_ASSIGNED',
        actionItemId: row.id,
      })
      if (!assignedNotification.sent) {
        console.warn('NC action assignment notification not sent', {
          nonConformityId: id,
          actionItemId: row.id,
          reason: assignedNotification.reason,
        })
      }
    }

    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao salvar plano de ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Nível SST inválido.' }, { status: 403 })
    }
    await assertCanFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.PLANO_DE_ACAO, Action.UPDATE)

    const id = (await params).id
    const blocked = await assertEditable(id, me.id, level)
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })

    const body = await req.json().catch(() => ({} as any))
    const actionId = String(body?.id || '')
    if (!actionId) return NextResponse.json({ error: 'id da ação é obrigatório.' }, { status: 400 })

   const existing = await prisma.nonConformityActionItem.findUnique({
      where: { id: actionId },
      select: {
        id: true,
        nonConformityId: true,
        status: true,
        evidencias: true,
        prazo: true,
        dataInicioPrevista: true,
        dataConclusao: true,
        responsavelId: true,
      },
    })
    if (!existing || existing.nonConformityId !== id) {
      return NextResponse.json({ error: 'Ação não encontrada para esta não conformidade.' }, { status: 404 })
    }

    const nextPrazo = body?.prazo !== undefined ? (body.prazo ? new Date(body.prazo) : null) : existing.prazo
    const desiredStatus = resolveAutomaticActionStatus({
      currentStatus: existing.status,
      requestedStatus: body?.status,
      prazo: nextPrazo,
      dataInicioPrevista:
        body?.dataInicioPrevista !== undefined ? toDate(body?.dataInicioPrevista) : existing.dataInicioPrevista,
      dataConclusao: body?.dataConclusao !== undefined ? toDate(body?.dataConclusao) : existing.dataConclusao,
    })
    const observacao = String(body?.observacao || '').trim()
    const shouldSetConclusion = desiredStatus === NonConformityActionStatus.CONCLUIDA
    const shouldClearConclusion = desiredStatus === NonConformityActionStatus.PENDENTE || desiredStatus === NonConformityActionStatus.EM_ANDAMENTO

    const row = await prisma.$transaction(async (tx) => {
      const previous = await tx.nonConformityActionItem.findUnique({
        where: { id: actionId },
        select: { id: true, descricao: true, status: true, evidencias: true },
      })
      const baseEvidence = body?.evidencias !== undefined
        ? (body?.evidencias ? String(body.evidencias).trim() : null)
        : (previous?.evidencias || null)
      const evidenciasWithObs = observacao
        ? `${baseEvidence ? `${baseEvidence}\n\n` : ''}[${new Date().toLocaleString('pt-BR')}] ${me.fullName || me.email}: ${observacao}`
        : baseEvidence


      const updated = await tx.nonConformityActionItem.update({
       where: { id: actionId },
        data: {
          descricao: body?.descricao !== undefined ? String(body.descricao).trim() : undefined,
          motivoBeneficio: toOptionalString(body?.motivoBeneficio),
          atividadeComo: toOptionalString(body?.atividadeComo),
          centroImpactadoId: body?.centroImpactadoId !== undefined ? (body?.centroImpactadoId ? String(body.centroImpactadoId) : null) : undefined,
          centroImpactadoDescricao: toOptionalString(body?.centroImpactadoDescricao),
          centroResponsavelId: body?.centroResponsavelId !== undefined ? (body?.centroResponsavelId ? String(body.centroResponsavelId) : null) : undefined,
          dataInicioPrevista: toDate(body?.dataInicioPrevista),
          dataFimPrevista: toDate(body?.dataFimPrevista),
          custo: toOptionalDecimal(body?.custo),
          dataConclusao: shouldSetConclusion ? (toDate(body?.dataConclusao) ?? new Date()) : shouldClearConclusion ? null : toDate(body?.dataConclusao),
          tipo: Object.values(NonConformityActionType).includes(body?.tipo) ? body.tipo : undefined,
          origem: toOptionalString(body?.origem),
          referencia: toOptionalString(body?.referencia),
          rapidez: toOptionalIntBetween(body?.rapidez),
          autonomia: toOptionalIntBetween(body?.autonomia),
          beneficio: toOptionalIntBetween(body?.beneficio),
          responsavelId: body?.responsavelId !== undefined ? (body.responsavelId || null) : undefined,
          responsavelNome: body?.responsavelNome !== undefined ? (body.responsavelNome ? String(body.responsavelNome).trim() : null) : undefined,
          prazo: body?.prazo !== undefined ? (body.prazo ? new Date(body.prazo) : null) : undefined,
          status: desiredStatus,
          evidencias: observacao || body?.evidencias !== undefined ? evidenciasWithObs : undefined,
        },
      })

      await appendNonConformityTimelineEvent(tx, {
        nonConformityId: id,
        actorId: me.id,
        tipo: 'PLANO_ACAO',
        message: observacao
          ? `Ação ${updated.id}: observação adicionada - ${observacao}`
          : previous?.status && previous.status !== updated.status
            ? `Ação ${updated.id} alterada de ${previous.status} para ${updated.status}${updated.descricao ? ` - ${updated.descricao}` : ''}`
            : `Ação ${updated.id} atualizada (${updated.status})${updated.descricao ? ` - ${updated.descricao}` : ''}`,
      })
      return updated
    })

    const shouldNotifyAssigned = row.responsavelId && row.responsavelId !== existing.responsavelId
    if (shouldNotifyAssigned) {
      const assignedNotification = await notifyNonConformityStakeholders({
        nonConformityId: id,
        actorId: me.id,
        event: 'ACTION_ITEM_ASSIGNED',
        actionItemId: row.id,
      })
      if (!assignedNotification.sent) {
        console.warn('NC action assignment notification not sent', {
          nonConformityId: id,
          actionItemId: row.id,
          reason: assignedNotification.reason,
        })
      }
    }

    if (existing.status !== row.status && row.status === NonConformityActionStatus.CONCLUIDA) {
      const completedNotification = await notifyNonConformityStakeholders({
        nonConformityId: id,
        actorId: me.id,
        event: 'ACTION_ITEM_COMPLETED',
        actionItemId: row.id,
      })
      if (!completedNotification.sent) {
        console.warn('NC action completion notification not sent', {
          nonConformityId: id,
          actionItemId: row.id,
          reason: completedNotification.reason,
        })
      }
    }

    return NextResponse.json(row)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Nível SST inválido.' }, { status: 403 })
    }
    await assertCanFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.PLANO_DE_ACAO, Action.DELETE)

    const id = (await params).id
    const blocked = await assertEditable(id, me.id, level)
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })

    const body = await req.json().catch(() => ({} as any))
    const actionId = String(body?.id || '')
    if (!actionId) return NextResponse.json({ error: 'id da ação é obrigatório.' }, { status: 400 })

    const existing = await prisma.nonConformityActionItem.findUnique({ where: { id: actionId }, select: { id: true, nonConformityId: true } })
    if (!existing || existing.nonConformityId !== id) {
      return NextResponse.json({ error: 'Ação não encontrada para esta não conformidade.' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.nonConformityActionItem.delete({ where: { id: actionId } })
      await appendNonConformityTimelineEvent(tx, {
        nonConformityId: id,
        actorId: me.id,
        tipo: 'PLANO_ACAO',
        message: `Ação ${actionId} removida do plano de ação`,
      })
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao excluir ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
