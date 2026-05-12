import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { notifySolicitationEvent } from '@/lib/solicitationOperationalNotifications'
import {
  canCancelSolicitation,
  canManageCancellationRequest,
  resolveUserAccessContext,
  type UserAccessContext,
} from '@/lib/solicitationAccessPolicy'
import type { SelectedAppUser } from '@/lib/auth'

export const CLOSED_CANCELLATION_STATUSES = new Set(['CANCELADA', 'CONCLUIDA', 'FINALIZADA', 'REJEITADA'])
export const DIRECT_REQUESTER_CANCELLATION_STATUSES = new Set([
  'ABERTA',
  'AGUARDANDO_ATENDIMENTO',
  'AGUARDANDO_APROVACAO',
])
export const CANCELLATION_CLOSED_ERROR = 'Esta solicitação já está encerrada e não pode ser cancelada.'

export type CancellationAction = 'NONE' | 'DIRECT' | 'REQUEST'

type SolicitationForCancellation = {
  id: string
  tipoId: string | null
  status: string | null
  solicitanteId: string
  approverId?: string | null
  assumidaPorId?: string | null
  departmentId?: string | null
  payload?: unknown
  solicitacaoSetores?: { setor?: string | null }[]
}

export function assertRequiredReason(reason: unknown, field = 'motivo') {
  const normalized = typeof reason === 'string' ? reason.trim() : ''
  if (!normalized) {
    throw Object.assign(new Error(field === 'justificativa' ? 'Informe a justificativa.' : 'Informe o motivo do cancelamento.'), {
      status: 400,
    })
  }
  return normalized
}

export function isClosedForCancellation(status?: string | null) {
  return CLOSED_CANCELLATION_STATUSES.has(String(status ?? '').toUpperCase())
}

export function canCancelDirectlyByProgress(solicitation: SolicitationForCancellation) {
  return (
    !solicitation.assumidaPorId &&
    DIRECT_REQUESTER_CANCELLATION_STATUSES.has(String(solicitation.status ?? '').toUpperCase())
  )
}

export function mustRequestCancellationByProgress(solicitation: SolicitationForCancellation) {
  return !canCancelDirectlyByProgress(solicitation)
}

export function requesterCanCancelDirectly(solicitation: SolicitationForCancellation, _userId: string) {
  return canCancelDirectlyByProgress(solicitation)
}

export function requesterMustRequestCancellation(solicitation: SolicitationForCancellation, _userId: string) {
  return mustRequestCancellationByProgress(solicitation)
}

export function resolveCancellationAction(params: {
  solicitation: SolicitationForCancellation
  userId: string
  userAccess: UserAccessContext
}) : CancellationAction {
  if (isClosedForCancellation(params.solicitation.status)) return 'NONE'
  if (!canCancelSolicitation(params.userAccess, params.solicitation)) return 'NONE'
  if (canCancelDirectlyByProgress(params.solicitation)) return 'DIRECT'
  return 'REQUEST'
}

export async function resolveCancellationContext(me: SelectedAppUser, solicitation: SolicitationForCancellation) {
  const userAccess = await resolveUserAccessContext({
    userId: me.id,
    userLogin: me.login,
    userEmail: me.email,
    userFullName: me.fullName,
    role: me.role,
    primaryDepartmentId: me.departmentId,
    primaryDepartment: me.department,
  })
  return {
    userAccess,
    action: resolveCancellationAction({ solicitation, userId: me.id, userAccess }),
    canOperationallyCancel: canManageCancellationRequest(userAccess, solicitation),
  }
}

export async function registerDirectCancellation(params: {
  solicitationId: string
  previousStatus: string
  actorId: string
  actorName: string
  motivo: string
}) {
  const agora = new Date()
  const message = `Solicitação cancelada por ${params.actorName}. Motivo: ${params.motivo}.`
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.solicitation.update({
      where: { id: params.solicitationId },
      data: {
        status: 'CANCELADA',
        dataCancelamento: agora,
        approvalStatus: 'REPROVADO',
        approvalAt: agora,
        approvalComment: params.motivo,
        cancelamentoStatus: null,
        cancelamentoSolicitadoPorId: null,
        cancelamentoSolicitadoEm: null,
        cancelamentoMotivo: params.motivo,
        cancelamentoAnalisadoPorId: params.actorId,
        cancelamentoAnalisadoEm: agora,
        cancelamentoJustificativaAnalise: params.motivo,
        cancelamentoOrigem: 'DIRETO',
      },
    })
    await tx.solicitationTimeline.create({ data: { solicitationId: params.solicitationId, status: 'CANCELADA', message } })
    await tx.event.create({ data: { id: randomUUID(), solicitationId: params.solicitationId, actorId: params.actorId, tipo: 'CANCELADA' } })
    return row
  })

  await notifySolicitationEvent({
    solicitationId: params.solicitationId,
    event: 'CANCELED',
    actorName: params.actorName,
    reason: params.motivo,
    dedupeKey: `CANCELED:${params.solicitationId}:${Date.now()}`,
  })

  return updated
}

export async function registerCancellationRequest(params: {
  solicitationId: string
  actorId: string
  motivo: string
}) {
  const agora = new Date()
  const message = `Cancelamento solicitado. Motivo: ${params.motivo}.`
  return prisma.$transaction(async (tx) => {
    const row = await tx.solicitation.update({
      where: { id: params.solicitationId },
      data: {
        cancelamentoStatus: 'PENDENTE',
        cancelamentoSolicitadoPorId: params.actorId,
        cancelamentoSolicitadoEm: agora,
        cancelamentoMotivo: params.motivo,
        cancelamentoAnalisadoPorId: null,
        cancelamentoAnalisadoEm: null,
        cancelamentoJustificativaAnalise: null,
        cancelamentoOrigem: 'SOLICITADO',
      },
    })
    await tx.solicitationTimeline.create({ data: { solicitationId: params.solicitationId, status: 'CANCELAMENTO_SOLICITADO', message } })
    await tx.event.create({ data: { id: randomUUID(), solicitationId: params.solicitationId, actorId: params.actorId, tipo: 'CANCELAMENTO_SOLICITADO' } })
    return row
  })
}

export async function analyzeCancellationRequest(params: {
  solicitationId: string
  actorId: string
  actorName: string
  justificativa: string
  approve: boolean
}) {
  const agora = new Date()
  const status = params.approve ? 'APROVADO' : 'RECUSADO'
  const timelineStatus = params.approve ? 'CANCELAMENTO_APROVADO' : 'CANCELAMENTO_RECUSADO'
  const message = params.approve
    ? `Pedido de cancelamento aprovado por ${params.actorName}. Justificativa: ${params.justificativa}.`
    : `Pedido de cancelamento recusado por ${params.actorName}. Justificativa: ${params.justificativa}.`

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.solicitation.update({
      where: { id: params.solicitationId },
      data: {
        ...(params.approve ? { status: 'CANCELADA' as const, dataCancelamento: agora } : {}),
        cancelamentoStatus: status,
        cancelamentoAnalisadoPorId: params.actorId,
        cancelamentoAnalisadoEm: agora,
        cancelamentoJustificativaAnalise: params.justificativa,
        cancelamentoOrigem: 'SOLICITADO',
      },
    })
    await tx.solicitationTimeline.create({ data: { solicitationId: params.solicitationId, status: timelineStatus, message } })
    await tx.event.create({ data: { id: randomUUID(), solicitationId: params.solicitationId, actorId: params.actorId, tipo: timelineStatus } })
    if (params.approve) {
      await tx.solicitationTimeline.create({ data: { solicitationId: params.solicitationId, status: 'CANCELADA', message: `Solicitação cancelada após aprovação do pedido de cancelamento.` } })
      await tx.event.create({ data: { id: randomUUID(), solicitationId: params.solicitationId, actorId: params.actorId, tipo: 'CANCELADA' } })
    }
    return updated
  })

  if (params.approve) {
    await notifySolicitationEvent({
      solicitationId: params.solicitationId,
      event: 'CANCELED',
      actorName: params.actorName,
      reason: params.justificativa,
      dedupeKey: `CANCELLATION_APPROVED:${params.solicitationId}:${Date.now()}`,
    })
  }

  return row
}
