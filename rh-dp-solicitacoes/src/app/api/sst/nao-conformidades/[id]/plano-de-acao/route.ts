import { NextRequest, NextResponse } from 'next/server'
import { Action, ModuleLevel, NonConformityActionPlanOrigin, NonConformityActionStatus, NonConformityActionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'
import { resolveAutomaticActionStatus } from '@/lib/sst/actionStatusAutomation'
import { notifyNonConformityStakeholders } from '@/lib/sst/nonConformityNotifications'
import { registerAppError } from '@/lib/errorRegistry'

type ActionPlanContext = {
  me: Awaited<ReturnType<typeof requireActiveUser>>
  level: ModuleLevel | undefined
  id: string
}

type InvalidDate = 'INVALID_DATE'

async function authorizeActionPlanAccess(id: string): Promise<ActionPlanContext | NextResponse> {
  const me = await requireActiveUser()
  const { levels } = await getUserModuleContext(me.id)
  const level = normalizeSstLevel(levels)
  if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
    return NextResponse.json({ error: 'Nível SST inválido.' }, { status: 403 })
  }

  const canViewNonConformities = await canFeature(
    me.id,
    MODULE_KEYS.SST,
    FEATURE_KEYS.SST.NAO_CONFORMIDADES,
    Action.VIEW,
  )
  if (!canViewNonConformities) {
    return NextResponse.json({ error: 'Sem acesso à tela de Não Conformidades.' }, { status: 403 })
  }

  return { me, level, id }
}

async function assertEditable(id: string) {
  const nc = await prisma.nonConformity.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      aprovadoQualidadeStatus: true,
    },
  })
  if (!nc) return { error: 'Não conformidade não encontrada.', status: 404 }
  if (nc.status === 'CANCELADA' || nc.status === 'ENCERRADA') {
    return { error: 'Plano de ação não pode ser alterado em RNC cancelada ou encerrada.', status: 409 }
  }

  return null
}

function isNextResponse(value: ActionPlanContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse
}

async function registerActionPlanError(input: {
  method: 'POST' | 'PATCH' | 'DELETE'
  error: unknown
  me?: Awaited<ReturnType<typeof requireActiveUser>> | null
  nonConformityId?: string | null
  actionItemId?: string | null
}) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Erro ao salvar plano de ação', input.error)
  }
  await registerAppError({
    area: 'sst',
    route: '/api/sst/nao-conformidades/[id]/plano-de-acao',
    method: input.method,
    userId: input.me?.id,
    userLogin: input.me?.login || input.me?.email,
    message: 'Erro ao salvar plano de ação',
    error: input.error,
    statusCode: 500,
    metadata: {
      nonConformityId: input.nonConformityId,
      actionItemId: input.actionItemId,
    },
  })
}

function toNullableDate(value: unknown): Date | null | InvalidDate {
  if (value === undefined || value === null || value === '') return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return 'INVALID_DATE'
  return parsed
}

function toDate(value: unknown) {
  if (value === undefined) return undefined
  return toNullableDate(value)
}

function isInvalidDate(value: unknown): value is InvalidDate {
  return value === 'INVALID_DATE'
}

function parseActionStatus(value: unknown, required = false) {
  if (value === undefined || value === null || value === '') return required ? 'INVALID_STATUS' : undefined
  if (!Object.values(NonConformityActionStatus).includes(value as NonConformityActionStatus)) return 'INVALID_STATUS'
  return value as NonConformityActionStatus
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
  let me: Awaited<ReturnType<typeof requireActiveUser>> | null = null
  let id: string | null = null
  try {
    id = (await params).id
    const auth = await authorizeActionPlanAccess(id)
    if (isNextResponse(auth)) return auth
    me = auth.me

    const blocked = await assertEditable(id)
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })

      const body = await req.json().catch(() => ({} as any))
    const descricao = String(body?.descricao || '').trim()
    if (!descricao) return NextResponse.json({ error: 'Descrição é obrigatória.' }, { status: 400 })

  const row = await prisma.$transaction(async (tx) => {
      const dataInicioPrevista = toDate(body?.dataInicioPrevista)
      const dataFimPrevista = toDate(body?.dataFimPrevista)
      const prazo = toNullableDate(body?.prazo)
      const dataConclusao = toDate(body?.dataConclusao)
      if (
        isInvalidDate(dataInicioPrevista) ||
        isInvalidDate(dataFimPrevista) ||
        isInvalidDate(prazo) ||
        isInvalidDate(dataConclusao)
      ) {
        throw new Error('VALIDATION_INVALID_DATE')
      }
      const requestedStatus = parseActionStatus(body?.status)
      if (requestedStatus === 'INVALID_STATUS') throw new Error('VALIDATION_INVALID_STATUS')
      const status = resolveAutomaticActionStatus({
        requestedStatus,
        prazo,
        dataInicioPrevista,
        dataConclusao,
      })

      const created = await tx.nonConformityActionItem.create({
        data: {
          nonConformityId: id!,
          origemPlano: NonConformityActionPlanOrigin.NAO_CONFORMIDADE,
          createdById: me!.id,
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
        nonConformityId: id!,
        actorId: me!.id,
        tipo: 'PLANO_ACAO',
        message: `Ação ${created.id} criada no plano de ação (${created.status})${created.descricao ? ` - ${created.descricao}` : ''}`,
      })
      if (!created.responsavelId && created.responsavelNome) {
        await appendNonConformityTimelineEvent(tx, {
          nonConformityId: id!,
          actorId: me!.id,
          tipo: 'ALERTA',
          message: `Ação ${created.id} criada com responsável em texto livre (${created.responsavelNome}); sem notificação automática por ausência de usuário vinculado`,
        })
      }
      return created
    })

    const createNotification = await notifyNonConformityStakeholders({
      nonConformityId: id!,
      actorId: me!.id,
      event: 'ACTION_PLAN_CREATED',
      actionItemId: row.id,
    })
    if (!createNotification.sent) {
      console.warn('NC action plan creation notification not sent', {
        nonConformityId: id!,
        actionItemId: row.id,
        reason: createNotification.reason,
      })
    }

    if (row.responsavelId) {
      const assignedNotification = await notifyNonConformityStakeholders({
        nonConformityId: id!,
        actorId: me!.id,
        event: 'ACTION_ITEM_ASSIGNED',
        actionItemId: row.id,
      })
      if (!assignedNotification.sent) {
        console.warn('NC action assignment notification not sent', {
          nonConformityId: id!,
          actionItemId: row.id,
          reason: assignedNotification.reason,
        })
      }
    }

    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'VALIDATION_INVALID_DATE') {
      return NextResponse.json({ error: 'Data do prazo inválida.' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'VALIDATION_INVALID_STATUS') {
      return NextResponse.json({ error: 'Status da ação inválido.' }, { status: 400 })
    }
    await registerActionPlanError({ method: 'POST', error, me, nonConformityId: id })
    return NextResponse.json({ error: 'Erro ao salvar plano de ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let me: Awaited<ReturnType<typeof requireActiveUser>> | null = null
  let id: string | null = null
  let actionId: string | null = null
  try {
    id = (await params).id
    const auth = await authorizeActionPlanAccess(id)
    if (isNextResponse(auth)) return auth
    me = auth.me

    const blocked = await assertEditable(id)
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })

    const body = await req.json().catch(() => ({} as any))
    actionId = String(body?.id || '')
    if (!actionId) return NextResponse.json({ error: 'id da ação é obrigatório.' }, { status: 400 })

   const existing = await prisma.nonConformityActionItem.findUnique({
      where: { id: actionId! },
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

    const nextPrazo = body?.prazo !== undefined ? toNullableDate(body.prazo) : existing.prazo
    const nextDataInicioPrevista = body?.dataInicioPrevista !== undefined ? toDate(body?.dataInicioPrevista) : existing.dataInicioPrevista
    const nextDataConclusao = body?.dataConclusao !== undefined ? toDate(body?.dataConclusao) : existing.dataConclusao
    const nextDataFimPrevista = body?.dataFimPrevista !== undefined ? toDate(body?.dataFimPrevista) : undefined
    if (
      isInvalidDate(nextPrazo) ||
      isInvalidDate(nextDataInicioPrevista) ||
      isInvalidDate(nextDataConclusao) ||
      isInvalidDate(nextDataFimPrevista)
    ) {
      return NextResponse.json({ error: 'Data do prazo inválida.' }, { status: 400 })
    }
    const requestedStatus = parseActionStatus(body?.status)
    if (requestedStatus === 'INVALID_STATUS') {
      return NextResponse.json({ error: 'Status da ação inválido.' }, { status: 400 })
    }
    const desiredStatus = resolveAutomaticActionStatus({
      currentStatus: existing.status,
      requestedStatus,
      prazo: nextPrazo,
      dataInicioPrevista: nextDataInicioPrevista,
      dataConclusao: nextDataConclusao,
    })
    const observacao = String(body?.observacao || '').trim()
    const shouldSetConclusion = desiredStatus === NonConformityActionStatus.CONCLUIDA
    const shouldClearConclusion = desiredStatus === NonConformityActionStatus.PENDENTE || desiredStatus === NonConformityActionStatus.EM_ANDAMENTO

    const row = await prisma.$transaction(async (tx) => {
      const previous = await tx.nonConformityActionItem.findUnique({
        where: { id: actionId! },
        select: { id: true, descricao: true, status: true, evidencias: true },
      })
      const baseEvidence = body?.evidencias !== undefined
        ? (body?.evidencias ? String(body.evidencias).trim() : null)
        : (previous?.evidencias || null)
      const evidenciasWithObs = observacao
        ? `${baseEvidence ? `${baseEvidence}\n\n` : ''}[${new Date().toLocaleString('pt-BR')}] ${me!.fullName || me!.email}: ${observacao}`
        : baseEvidence


      const updated = await tx.nonConformityActionItem.update({
       where: { id: actionId! },
        data: {
          descricao: body?.descricao !== undefined ? String(body.descricao).trim() : undefined,
          motivoBeneficio: toOptionalString(body?.motivoBeneficio),
          atividadeComo: toOptionalString(body?.atividadeComo),
          centroImpactadoId: body?.centroImpactadoId !== undefined ? (body?.centroImpactadoId ? String(body.centroImpactadoId) : null) : undefined,
          centroImpactadoDescricao: toOptionalString(body?.centroImpactadoDescricao),
          centroResponsavelId: body?.centroResponsavelId !== undefined ? (body?.centroResponsavelId ? String(body.centroResponsavelId) : null) : undefined,
          dataInicioPrevista: toDate(body?.dataInicioPrevista),
          dataFimPrevista: nextDataFimPrevista,
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
          prazo: body?.prazo !== undefined ? nextPrazo : undefined,
          status: desiredStatus,
          evidencias: observacao || body?.evidencias !== undefined ? evidenciasWithObs : undefined,
        },
      })

      await appendNonConformityTimelineEvent(tx, {
        nonConformityId: id!,
        actorId: me!.id,
        tipo: 'PLANO_ACAO',
        message: observacao
          ? `Ação ${updated.id} atualizada no plano de ação - observação adicionada`
          : previous?.status && previous.status !== updated.status
            ? `Ação ${updated.id} atualizada no plano de ação (${previous.status} -> ${updated.status})${updated.descricao ? ` - ${updated.descricao}` : ''}`
            : `Ação ${updated.id} atualizada no plano de ação (${updated.status})${updated.descricao ? ` - ${updated.descricao}` : ''}`,
      })
      if (!updated.responsavelId && updated.responsavelNome) {
        await appendNonConformityTimelineEvent(tx, {
          nonConformityId: id!,
          actorId: me!.id,
          tipo: 'ALERTA',
          message: `Ação ${updated.id} permanece com responsável em texto livre (${updated.responsavelNome}); sem notificação automática por ausência de usuário vinculado`,
        })
      }
      return updated
    })

    const shouldNotifyAssigned = row.responsavelId && row.responsavelId !== existing.responsavelId
    if (shouldNotifyAssigned) {
      const assignedNotification = await notifyNonConformityStakeholders({
        nonConformityId: id!,
        actorId: me!.id,
        event: 'ACTION_ITEM_ASSIGNED',
        actionItemId: row.id,
      })
      if (!assignedNotification.sent) {
        console.warn('NC action assignment notification not sent', {
          nonConformityId: id!,
          actionItemId: row.id,
          reason: assignedNotification.reason,
        })
      }
    }

    if (existing.status !== row.status && row.status === NonConformityActionStatus.CONCLUIDA) {
      const completedNotification = await notifyNonConformityStakeholders({
        nonConformityId: id!,
        actorId: me!.id,
        event: 'ACTION_ITEM_COMPLETED',
        actionItemId: row.id,
      })
      if (!completedNotification.sent) {
        console.warn('NC action completion notification not sent', {
          nonConformityId: id!,
          actionItemId: row.id,
          reason: completedNotification.reason,
        })
      }
    }

    return NextResponse.json(row)
  } catch (error) {
    await registerActionPlanError({ method: 'PATCH', error, me, nonConformityId: id!, actionItemId: actionId })
    return NextResponse.json({ error: 'Erro ao salvar plano de ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let me: Awaited<ReturnType<typeof requireActiveUser>> | null = null
  let id: string | null = null
  let actionId: string | null = null
  try {
    id = (await params).id
    const auth = await authorizeActionPlanAccess(id)
    if (isNextResponse(auth)) return auth
    me = auth.me

    const blocked = await assertEditable(id)
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })

    const body = await req.json().catch(() => ({} as any))
    actionId = String(body?.id || '')
    if (!actionId) return NextResponse.json({ error: 'id da ação é obrigatório.' }, { status: 400 })

    const existing = await prisma.nonConformityActionItem.findUnique({ where: { id: actionId! }, select: { id: true, nonConformityId: true } })
    if (!existing || existing.nonConformityId !== id) {
      return NextResponse.json({ error: 'Ação não encontrada para esta não conformidade.' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.nonConformityActionItem.delete({ where: { id: actionId! } })
      await appendNonConformityTimelineEvent(tx, {
        nonConformityId: id!,
        actorId: me!.id,
        tipo: 'PLANO_ACAO',
        message: `Ação ${actionId!} excluída do plano de ação`,
      })
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    await registerActionPlanError({ method: 'DELETE', error, me, nonConformityId: id!, actionItemId: actionId })
    return NextResponse.json({ error: 'Erro ao salvar plano de ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
