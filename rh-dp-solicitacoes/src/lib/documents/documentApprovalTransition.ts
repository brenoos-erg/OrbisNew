import {
  DocumentApprovalDecisionStatus,
  DocumentApprovalRoundStatus,
  DocumentApprovalStepStatus,
  DocumentApprovalStatus,
  DocumentFlowStepType,
  DocumentVersionStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client'
import { createDocumentSourceApproverSnapshotRound } from '@/lib/documents/documentApprovalSnapshot'
import { prisma } from '@/lib/prisma'

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

type FlowItemWithMembers = Prisma.DocumentTypeApprovalFlowGetPayload<{
  include: { approverGroup: { include: { members: { include: { user: { select: { status: true } } } } } } }
}>

async function nextRoundNumber(tx: Tx, versionId: string) {
  const latest = await tx.documentApprovalRound.findFirst({
    where: { versionId },
    orderBy: { roundNumber: 'desc' },
    select: { roundNumber: true },
  })
  return (latest?.roundNumber ?? 0) + 1
}

export async function startDocumentApprovalFlow(tx: Tx, input: { versionId: string; flow: FlowItemWithMembers[] }) {
  const lockName = `document-approval-round:${input.versionId}`
  const lock = await tx.$queryRaw<Array<{ locked: number | bigint | null }>>`SELECT GET_LOCK(${lockName}, 10) AS locked`
  if (Number(lock[0]?.locked ?? 0) !== 1) throw new Error('Não foi possível bloquear a criação da rodada de aprovação.')

  try {
    const pendingRound = await tx.documentApprovalRound.findFirst({
      where: { versionId: input.versionId, status: DocumentApprovalRoundStatus.PENDING },
      select: { id: true },
    })
    if (pendingRound) throw new Error('Já existe rodada de aprovação pendente para esta versão.')

    const roundNumber = await nextRoundNumber(tx, input.versionId)
    const round = await tx.documentApprovalRound.create({ data: { versionId: input.versionId, roundNumber } })

    for (const item of input.flow) {
      const members = [...new Set((item.approverGroup?.members ?? [])
        .filter((member) => member.userId && (!member.user || member.user.status === 'ATIVO'))
        .map((member) => member.userId))]
      if (members.length === 0) throw new Error('Grupo aprovador sem membros ativos.')
      if (item.approvalRule === 'MINIMUM') {
        const minimum = item.minimumApprovals ?? 0
        if (minimum < 1 || minimum > members.length) throw new Error('Quantidade mínima de aprovações inválida para o grupo.')
      }

      const step = await tx.documentApprovalStep.create({
        data: {
          versionId: input.versionId,
          roundId: round.id,
          flowItemId: item.id,
          order: item.order,
          stepType: item.stepType,
          approvalRule: item.approvalRule,
          minimumApprovals: item.minimumApprovals,
        },
      })
      await tx.documentApprovalDecision.createMany({ data: members.map((userId) => ({ stepId: step.id, userId })) })
    }

    await createDocumentSourceApproverSnapshotRound(tx, { versionId: input.versionId, roundNumber, flow: input.flow })
    await advanceDocumentWorkflow(tx, { versionId: input.versionId })
    return round
  } finally {
    await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`.catch(() => undefined)
  }
}

export async function evaluateApprovalStep(tx: Tx, stepId: string, actorUserId?: string) {
  const step = await tx.documentApprovalStep.findUnique({ where: { id: stepId }, include: { decisions: true } })
  if (!step) throw new Error('Etapa de aprovação não encontrada.')

  const rejected = step.decisions.some((decision) => decision.status === DocumentApprovalDecisionStatus.REJECTED)
  if (rejected) {
    await tx.documentApprovalDecision.updateMany({
      where: { stepId, status: DocumentApprovalDecisionStatus.PENDING },
      data: {
        status: DocumentApprovalDecisionStatus.WAIVED,
        waivedAt: new Date(),
        waivedById: actorUserId,
        waiveReason: 'Etapa reprovada.',
      },
    })
    await tx.documentApprovalStep.update({
      where: { id: stepId },
      data: { status: DocumentApprovalStepStatus.REJECTED, completedAt: new Date() },
    })
    return DocumentApprovalStepStatus.REJECTED
  }

  const approvedDistinct = new Set(step.decisions
    .filter((decision) => decision.status === DocumentApprovalDecisionStatus.APPROVED)
    .map((decision) => decision.userId)).size
  const requiredDistinct = new Set(step.decisions
    .filter((decision) => decision.required)
    .map((decision) => decision.userId)).size
  const pendingDistinct = new Set(step.decisions
    .filter((decision) => decision.status === DocumentApprovalDecisionStatus.PENDING)
    .map((decision) => decision.userId)).size
  const minimum = step.approvalRule === 'MINIMUM'
    ? (step.minimumApprovals ?? 0)
    : step.approvalRule === 'ANY'
      ? 1
      : requiredDistinct

  if (minimum >= 1 && approvedDistinct >= minimum) {
    await tx.documentApprovalDecision.updateMany({
      where: { stepId, status: DocumentApprovalDecisionStatus.PENDING },
      data: {
        status: DocumentApprovalDecisionStatus.WAIVED,
        waivedAt: new Date(),
        waivedById: actorUserId,
        waiveReason: 'Regra de aprovação satisfeita.',
      },
    })
    await tx.documentApprovalStep.update({
      where: { id: stepId },
      data: { status: DocumentApprovalStepStatus.APPROVED, completedAt: new Date() },
    })
    return DocumentApprovalStepStatus.APPROVED
  }

  if (pendingDistinct === 0) {
    await tx.documentApprovalStep.update({
      where: { id: stepId },
      data: { status: DocumentApprovalStepStatus.WAIVED, completedAt: new Date() },
    })
    return DocumentApprovalStepStatus.WAIVED
  }

  return DocumentApprovalStepStatus.PENDING
}

export async function advanceDocumentWorkflow(tx: Tx, input: { versionId: string }) {
  const round = await tx.documentApprovalRound.findFirst({
    where: { versionId: input.versionId, status: DocumentApprovalRoundStatus.PENDING },
    orderBy: { roundNumber: 'desc' },
  })
  if (!round) return null

  const rejected = await tx.documentApprovalStep.findFirst({
    where: { roundId: round.id, status: DocumentApprovalStepStatus.REJECTED },
  })
  if (rejected) {
    await tx.documentApprovalRound.update({
      where: { id: round.id },
      data: { status: DocumentApprovalRoundStatus.REJECTED, completedAt: new Date() },
    })
    await tx.documentVersion.update({
      where: { id: input.versionId },
      data: { status: DocumentVersionStatus.EM_ELABORACAO },
    })
    return DocumentVersionStatus.EM_ELABORACAO
  }

  const cancelled = await tx.documentApprovalStep.findFirst({
    where: { roundId: round.id, status: DocumentApprovalStepStatus.CANCELLED },
  })
  if (cancelled) return null

  const pending = await tx.documentApprovalStep.findFirst({
    where: { roundId: round.id, status: DocumentApprovalStepStatus.PENDING },
    orderBy: { order: 'asc' },
  })

  let nextStatus: DocumentVersionStatus
  if (!pending) {
    const blocking = await tx.documentApprovalStep.findFirst({
      where: {
        roundId: round.id,
        status: { notIn: [DocumentApprovalStepStatus.APPROVED, DocumentApprovalStepStatus.WAIVED] },
      },
    })
    if (blocking) return null
    await tx.documentApprovalRound.update({
      where: { id: round.id },
      data: { status: DocumentApprovalRoundStatus.APPROVED, completedAt: new Date() },
    })
    nextStatus = DocumentVersionStatus.AGUARDANDO_PUBLICACAO
  } else if (pending.stepType === DocumentFlowStepType.QUALITY) {
    nextStatus = DocumentVersionStatus.EM_ANALISE_QUALIDADE
  } else {
    nextStatus = DocumentVersionStatus.AG_APROVACAO
  }

  await tx.documentVersion.update({ where: { id: input.versionId }, data: { status: nextStatus } })
  return nextStatus
}

export async function getCurrentPendingApprovalStep(versionId: string) {
  const round = await prisma.documentApprovalRound.findFirst({
    where: { versionId, status: DocumentApprovalRoundStatus.PENDING },
    orderBy: { roundNumber: 'desc' },
  })
  if (!round) return null

  const step = await prisma.documentApprovalStep.findFirst({
    where: { versionId, roundId: round.id, status: DocumentApprovalStepStatus.PENDING },
    orderBy: { order: 'asc' },
    include: { flowItem: true, decisions: true },
  })
  return step ? { round, step } : null
}

async function getCurrentPendingApprovalStepForTx(tx: Tx, versionId: string) {
  const round = await tx.documentApprovalRound.findFirst({
    where: { versionId, status: DocumentApprovalRoundStatus.PENDING },
    orderBy: { roundNumber: 'desc' },
  })
  if (!round) return null

  const step = await tx.documentApprovalStep.findFirst({
    where: { versionId, roundId: round.id, status: DocumentApprovalStepStatus.PENDING },
    orderBy: { order: 'asc' },
    include: { flowItem: true, decisions: true, version: { include: { document: true } } },
  })
  return step ? { round, step } : null
}

async function acquireApprovalVersionLock(tx: Tx, versionId: string) {
  const lockName = `document-approval-version:${versionId}`
  const lock = await tx.$queryRaw<Array<{ locked: number | bigint | null }>>`SELECT GET_LOCK(${lockName}, 10) AS locked`
  if (Number(lock[0]?.locked ?? 0) !== 1) throw new Error('Não foi possível bloquear o fluxo de aprovação.')
  return lockName
}

export async function approveDocumentDecision(tx: Tx, input: { versionId: string; actorUserId: string; comment?: string | null }) {
  const lockName = await acquireApprovalVersionLock(tx, input.versionId)
  try {
    const current = await getCurrentPendingApprovalStepForTx(tx, input.versionId)
    if (!current) throw new Error('Não há etapa pendente.')
    const { round, step } = current

    if (step.version.document.authorUserId === input.actorUserId) {
      throw new Error(step.stepType === DocumentFlowStepType.QUALITY
        ? 'Você não pode aprovar a Qualidade de um documento elaborado por você.'
        : 'Você não pode aprovar tecnicamente um documento elaborado por você.')
    }

    const decision = await tx.documentApprovalDecision.findUnique({
      where: { stepId_userId: { stepId: step.id, userId: input.actorUserId } },
    })
    if (!decision) throw new Error('Você não faz parte do snapshot de aprovação desta etapa.')

    const claimed = await tx.documentApprovalDecision.updateMany({
      where: { id: decision.id, status: DocumentApprovalDecisionStatus.PENDING },
      data: {
        status: DocumentApprovalDecisionStatus.APPROVED,
        decidedAt: new Date(),
        comment: input.comment ?? null,
      },
    })
    if (claimed.count !== 1) throw new Error('Decisão já registrada para esta etapa.')

    const stepStatus = await evaluateApprovalStep(tx, step.id, input.actorUserId)
    const nextStatus = await advanceDocumentWorkflow(tx, { versionId: input.versionId })
    const legacyApproval = await tx.documentApproval.findUnique({
      where: { versionId_flowItemId: { versionId: input.versionId, flowItemId: step.flowItemId } },
    })
    if (legacyApproval && [DocumentApprovalStepStatus.APPROVED, DocumentApprovalStepStatus.WAIVED].includes(stepStatus)) {
      await tx.documentApproval.update({
        where: { id: legacyApproval.id },
        data: {
          status: DocumentApprovalStatus.APPROVED,
          decidedById: input.actorUserId,
          decidedAt: new Date(),
          comment: input.comment ?? null,
        },
      })
    }
    return { nextStatus, step, round, stepStatus }
  } finally {
    await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`.catch(() => undefined)
  }
}

export async function rejectDocumentDecision(tx: Tx, input: { versionId: string; actorUserId: string; comment: string }) {
  const lockName = await acquireApprovalVersionLock(tx, input.versionId)
  try {
    const current = await getCurrentPendingApprovalStepForTx(tx, input.versionId)
    if (!current) throw new Error('Não há etapa pendente.')
    const { round, step } = current

    const decision = await tx.documentApprovalDecision.findUnique({
      where: { stepId_userId: { stepId: step.id, userId: input.actorUserId } },
    })
    if (!decision) throw new Error('Você não faz parte do snapshot de aprovação desta etapa.')

    const claimed = await tx.documentApprovalDecision.updateMany({
      where: { id: decision.id, status: DocumentApprovalDecisionStatus.PENDING },
      data: {
        status: DocumentApprovalDecisionStatus.REJECTED,
        decidedAt: new Date(),
        comment: input.comment,
      },
    })
    if (claimed.count !== 1) throw new Error('Decisão já registrada para esta etapa.')

    await evaluateApprovalStep(tx, step.id, input.actorUserId)
    await tx.documentApprovalDecision.updateMany({
      where: { step: { roundId: round.id }, status: DocumentApprovalDecisionStatus.PENDING },
      data: {
        status: DocumentApprovalDecisionStatus.WAIVED,
        waivedAt: new Date(),
        waivedById: input.actorUserId,
        waiveReason: 'Rodada reprovada.',
      },
    })
    await tx.documentApprovalStep.updateMany({
      where: { roundId: round.id, status: DocumentApprovalStepStatus.PENDING },
      data: { status: DocumentApprovalStepStatus.CANCELLED, completedAt: new Date() },
    })
    await tx.documentApprovalRound.update({
      where: { id: round.id },
      data: { status: DocumentApprovalRoundStatus.REJECTED, completedAt: new Date() },
    })
    await tx.documentVersion.update({
      where: { id: input.versionId },
      data: { status: DocumentVersionStatus.EM_ELABORACAO },
    })
    await tx.documentApproval.updateMany({
      where: { versionId: input.versionId, flowItemId: step.flowItemId },
      data: {
        status: DocumentApprovalStatus.REJECTED,
        decidedById: input.actorUserId,
        decidedAt: new Date(),
        comment: input.comment,
      },
    })
    return { nextStatus: DocumentVersionStatus.EM_ELABORACAO, step, round }
  } finally {
    await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`.catch(() => undefined)
  }
}

export async function cancelDocumentApprovalFlow(tx: Tx, input: { versionId: string }) {
  const round = await tx.documentApprovalRound.findFirst({
    where: { versionId: input.versionId, status: DocumentApprovalRoundStatus.PENDING },
    orderBy: { roundNumber: 'desc' },
  })
  if (!round) return null

  await tx.documentApprovalDecision.updateMany({
    where: { step: { roundId: round.id }, status: DocumentApprovalDecisionStatus.PENDING },
    data: {
      status: DocumentApprovalDecisionStatus.WAIVED,
      waivedAt: new Date(),
      waiveReason: 'Fluxo cancelado.',
    },
  })
  await tx.documentApprovalStep.updateMany({
    where: { roundId: round.id, status: DocumentApprovalStepStatus.PENDING },
    data: { status: DocumentApprovalStepStatus.CANCELLED, completedAt: new Date() },
  })
  await tx.documentApprovalRound.update({
    where: { id: round.id },
    data: { status: DocumentApprovalRoundStatus.CANCELLED, completedAt: new Date() },
  })
  return round
}

export const approveCurrentDocumentStep = approveDocumentDecision
export const rejectCurrentDocumentStep = rejectDocumentDecision
