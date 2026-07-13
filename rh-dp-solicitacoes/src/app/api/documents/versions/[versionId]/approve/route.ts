import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { canApproveDocumentStage } from '@/lib/documentApprovalControl'
import { prisma } from '@/lib/prisma'
import { sendDocumentNotification } from '@/lib/documents/documentNotificationService'
import { approveDocumentDecision, getCurrentPendingApprovalStep } from '@/lib/documents/documentApprovalTransition'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const body = await req.json().catch(() => null) ?? {}
  const comment = typeof body.comment === 'string' ? body.comment.trim() : null

  const version = await prisma.documentVersion.findUnique({ where: { id: versionId }, select: { id: true, status: true, documentId: true, revisionNumber: true } })
  if (!version) return NextResponse.json({ error: 'Versão não encontrada.' }, { status: 404 })

  const current = await getCurrentPendingApprovalStep(versionId)
  if (!current) return NextResponse.json({ error: 'Não há etapa pendente.' }, { status: 400 })
  const { round: currentRound, step: currentStep } = current
  const stage = currentStep.stepType === 'QUALITY' ? 3 : 2
  if (version.status !== DocumentVersionStatus.AG_APROVACAO && version.status !== DocumentVersionStatus.EM_ANALISE_QUALIDADE) {
    return NextResponse.json({ error: 'Esta versão não está em etapa de aprovação.' }, { status: 400 })
  }

  const canApprove = await canApproveDocumentStage(me.id, stage, me.role, versionId)
  if (!canApprove) return NextResponse.json({ error: 'Você não possui permissão para aprovar nesta etapa.' }, { status: 403 })

  if (currentStep.stepType === 'QUALITY') {
    const checklist = await prisma.documentQualityChecklist.findFirst({ where: { stepId: currentStep.id, reviewerUserId: me.id }, orderBy: [{ completedAt: 'desc' }, { updatedAt: 'desc' }] })
    if (!checklist || !checklist.completedAt || checklist.result !== 'APPROVED' || checklist.roundId !== currentRound.id) {
      return NextResponse.json({ error: 'Checklist da Qualidade pendente.' }, { status: 409 })
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transition = await approveDocumentDecision(tx, { versionId, actorUserId: me.id, comment })
      await tx.documentAuditLog.create({
        data: {
          documentId: version.documentId,
          versionId,
          userId: me.id,
          action: stage === 2 ? 'TECHNICAL_APPROVED' : 'QUALITY_APPROVED',
          reason: comment,
          metadata: { stepId: transition.step.id, stepType: transition.step.stepType },
        },
      })
      return transition
    })

    if (result.stepStatus === 'APPROVED') {
      const event = result.nextStatus === DocumentVersionStatus.EM_ANALISE_QUALIDADE
        ? 'DOCUMENT_QUALITY_REVIEW'
        : result.nextStatus === DocumentVersionStatus.AGUARDANDO_PUBLICACAO
          ? 'DOCUMENT_AWAITING_PUBLICATION'
          : 'DOCUMENT_APPROVED'
      void sendDocumentNotification(event, {
        documentId: version.documentId,
        versionId,
        flowItemId: currentStep.flowItemId,
        actorUserId: me.id,
      }).catch((error) => console.error(`${event} notification failed`, error))
    }

    return NextResponse.json({ ok: true, nextStatus: result.nextStatus })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao aprovar etapa.'
    const status = message.includes('snapshot') || message.includes('permissão') ? 403 : 409
    return NextResponse.json({ error: message }, { status })
  }
}
