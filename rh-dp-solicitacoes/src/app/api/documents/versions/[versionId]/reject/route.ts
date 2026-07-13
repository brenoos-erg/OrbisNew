import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { canApproveDocumentStage } from '@/lib/documentApprovalControl'
import { prisma } from '@/lib/prisma'
import { sendDocumentNotification } from '@/lib/documents/documentNotificationService'
import { getCurrentPendingApprovalStep, rejectDocumentDecision } from '@/lib/documents/documentApprovalTransition'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const body = await req.json().catch(() => null) ?? {}
  const comment = String(body.comment ?? '').trim()
  if (comment.length < 10) return NextResponse.json({ error: 'Comentário de reprovação deve ter ao menos 10 caracteres.' }, { status: 400 })

  const version = await prisma.documentVersion.findUnique({ where: { id: versionId }, select: { id: true, documentId: true } })
  if (!version) return NextResponse.json({ error: 'Versão não encontrada.' }, { status: 404 })
  const current = await getCurrentPendingApprovalStep(versionId)
  if (!current) return NextResponse.json({ error: 'Não há etapa pendente.' }, { status: 400 })
  const currentStep = current.step
  const stage = currentStep.stepType === 'QUALITY' ? 3 : 2
  if (!(await canApproveDocumentStage(me.id, stage, me.role, versionId))) return NextResponse.json({ error: 'Você não possui permissão para reprovar nesta etapa.' }, { status: 403 })
  if (currentStep.stepType === 'QUALITY') {
    const checklist = await prisma.documentQualityChecklist.findFirst({ where: { stepId: currentStep.id, reviewerUserId: me.id }, orderBy: [{ completedAt: 'desc' }, { updatedAt: 'desc' }] })
    if (!checklist || !checklist.completedAt || checklist.result !== 'REJECTED' || checklist.roundId !== current.round.id) {
      return NextResponse.json({ error: 'Reprovação da Qualidade deve ser concluída pelo checklist da rodada atual.' }, { status: 409 })
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transition = await rejectDocumentDecision(tx, { versionId, actorUserId: me.id, comment })
      await tx.documentAuditLog.create({ data: { documentId: version.documentId, versionId, userId: me.id, action: stage === 2 ? 'TECHNICAL_REJECTED' : 'QUALITY_REJECTED', reason: comment, metadata: { stepId: transition.step.id, stepType: transition.step.stepType } } })
      return transition
    })
    void sendDocumentNotification('DOCUMENT_REJECTED', { documentId: version.documentId, versionId, flowItemId: currentStep.flowItemId, actorUserId: me.id }).catch((error) => console.error('DOCUMENT_REJECTED notification failed', error))
    return NextResponse.json({ ok: true, nextStatus: result.nextStatus })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao reprovar etapa.' }, { status: 409 })
  }
}
