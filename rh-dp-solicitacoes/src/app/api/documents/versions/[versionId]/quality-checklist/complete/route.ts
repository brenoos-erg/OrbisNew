import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canReviewQualityDocument } from '@/lib/documents/documentRoleAccess'
import { approveDocumentDecision, getCurrentPendingApprovalStep, rejectDocumentDecision } from '@/lib/documents/documentApprovalTransition'
import { sendDocumentNotification } from '@/lib/documents/documentNotificationService'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  if (!(await canReviewQualityDocument(me.id, versionId))) return NextResponse.json({ error: 'Acesso negado ao checklist da Qualidade.' }, { status: 403 })
  const current = await getCurrentPendingApprovalStep(versionId)
  if (!current || current.step.stepType !== 'QUALITY') return NextResponse.json({ error: 'Versão não está na etapa de Qualidade.' }, { status: 404 })
  const body = await req.json().catch(() => null) ?? {}
  const result = String(body.result ?? '').trim()
  if (!['APPROVED', 'REJECTED'].includes(result)) return NextResponse.json({ error: 'Resultado do checklist deve ser APPROVED ou REJECTED.' }, { status: 400 })
  const notes = String(body.notes ?? '').trim()
  if (result === 'REJECTED' && notes.length < 10) return NextResponse.json({ error: 'Checklist reprovado exige motivo com no mínimo 10 caracteres.' }, { status: 400 })
  const requiredKeys = ['codigo', 'titulo', 'tipo', 'revisao', 'arquivo', 'legibilidade', 'validade', 'distribuicao']
  if (!body.items || typeof body.items !== 'object' || Array.isArray(body.items)) return NextResponse.json({ error: 'Checklist deve conter os itens obrigatórios.' }, { status: 400 })
  const items = body.items as Record<string, unknown>
  const keys = Object.keys(items)
  const allowedValues = new Set(['CONFORME', 'NAO_CONFORME', 'NAO_APLICAVEL'])
  if (keys.length === 0) return NextResponse.json({ error: 'Checklist vazio não pode ser concluído.' }, { status: 400 })
  const missing = requiredKeys.filter((key) => !(key in items))
  const unknown = keys.filter((key) => !requiredKeys.includes(key))
  if (missing.length || unknown.length) return NextResponse.json({ error: 'Checklist possui itens ausentes ou desconhecidos.', missing, unknown }, { status: 400 })
  const itemValues = Object.values(items).map(String)
  if (itemValues.some((value) => !allowedValues.has(value))) return NextResponse.json({ error: 'Checklist possui valor inválido.' }, { status: 400 })
  if (result === 'APPROVED' && itemValues.some((value) => value === 'NAO_CONFORME')) return NextResponse.json({ error: 'Checklist aprovado não pode conter item Não conforme.' }, { status: 400 })
  if (itemValues.some((value) => value === 'NAO_CONFORME' || value === 'NAO_APLICAVEL') && notes.length < 10) {
    return NextResponse.json({ error: 'Itens não conformes ou não aplicáveis exigem justificativa com no mínimo 10 caracteres.' }, { status: 400 })
  }
  const version = await prisma.documentVersion.findUniqueOrThrow({ where: { id: versionId }, select: { documentId: true } })
  const lockName = `document-quality-checklist:${current.step.id}:${me.id}`
  const outcome = await prisma.$transaction(async (tx) => {
    const lock = await tx.$queryRaw<Array<{ locked: number | bigint | null }>>`SELECT GET_LOCK(${lockName}, 10) AS locked`
    if (Number(lock[0]?.locked ?? 0) !== 1) throw new Error('Não foi possível bloquear o checklist da Qualidade.')
    try {
    const existing = await tx.documentQualityChecklist.findFirst({ where: { stepId: current.step.id, reviewerUserId: me.id }, orderBy: [{ completedAt: 'asc' }, { updatedAt: 'desc' }] })
    if (existing?.completedAt) throw new Error('Checklist já concluído.')
    const saved = existing
      ? await tx.documentQualityChecklist.update({ where: { id: existing.id }, data: { completedAt: new Date(), result: result as 'APPROVED' | 'REJECTED', notes: notes || null, items: items as any, roundId: current.round.id, stepId: current.step.id } })
      : await tx.documentQualityChecklist.create({ data: { versionId, roundId: current.round.id, stepId: current.step.id, reviewerUserId: me.id, completedAt: new Date(), result: result as 'APPROVED' | 'REJECTED', notes: notes || null, items: items as any } })
    const transition = result === 'REJECTED'
      ? await rejectDocumentDecision(tx, { versionId, actorUserId: me.id, comment: notes })
      : await approveDocumentDecision(tx, { versionId, actorUserId: me.id, comment: notes || 'Checklist da Qualidade aprovado.' })
    await tx.documentAuditLog.create({ data: { documentId: version.documentId, versionId, userId: me.id, action: result === 'REJECTED' ? 'QUALITY_REJECTED' : 'QUALITY_APPROVED', reason: notes || 'Checklist da Qualidade concluído.', metadata: { checklistId: saved.id, roundId: current.round.id, stepId: current.step.id, result: saved.result, nextStatus: transition.nextStatus } } })
    return { checklist: saved, transition }
    } finally {
      await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`.catch(() => undefined)
    }
  }).catch((error) => {
    if (error instanceof Error && error.message === 'Checklist já concluído.') return null
    throw error
  })
  if (!outcome) return NextResponse.json({ error: 'Checklist já concluído.' }, { status: 409 })
  if (result === 'REJECTED') {
    void sendDocumentNotification('DOCUMENT_REJECTED', { documentId: version.documentId, versionId, flowItemId: current.step.flowItemId, actorUserId: me.id }).catch((error) => console.error('DOCUMENT_REJECTED notification failed', error))
  } else if (outcome.transition.nextStatus === 'AGUARDANDO_PUBLICACAO') {
    void sendDocumentNotification('DOCUMENT_AWAITING_PUBLICATION', { documentId: version.documentId, versionId, flowItemId: current.step.flowItemId, actorUserId: me.id }).catch((error) => console.error('DOCUMENT_AWAITING_PUBLICATION notification failed', error))
  } else if (outcome.transition.nextStatus === 'EM_ANALISE_QUALIDADE') {
    void sendDocumentNotification('DOCUMENT_QUALITY_REVIEW', { documentId: version.documentId, versionId, flowItemId: current.step.flowItemId, actorUserId: me.id }).catch((error) => console.error('DOCUMENT_QUALITY_REVIEW notification failed', error))
  }
  return NextResponse.json(outcome.checklist)
}
