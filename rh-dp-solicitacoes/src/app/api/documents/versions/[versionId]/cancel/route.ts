import { DocumentVersionStatus } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { QUALITY_DOCUMENT_MANAGER_FORBIDDEN_MESSAGE } from '@/lib/documents/documentManagementAccess'
import { canCancelDocument } from '@/lib/documents/documentRoleAccess'
import { sendDocumentNotification } from '@/lib/documents/documentNotificationService'
import { cancelDocumentApprovalFlow } from '@/lib/documents/documentApprovalTransition'
import { prisma } from '@/lib/prisma'

async function validateReplacementDocument(replacementDocumentId: string | null, currentDocumentId: string) {
  if (!replacementDocumentId) return null
  if (replacementDocumentId === currentDocumentId) throw new Error('Documento substituto não pode ser o próprio documento cancelado.')
  const replacement = await prisma.isoDocument.findUnique({ where: { id: replacementDocumentId }, include: { currentPublishedVersion: true } })
  if (!replacement || !replacement.isActive || !replacement.currentPublishedVersion || replacement.currentPublishedVersion.status !== DocumentVersionStatus.PUBLICADO || !replacement.currentPublishedVersion.publishedFileUrl) {
    throw new Error('Documento substituto inválido ou sem versão vigente publicada.')
  }
  return replacement
}

export async function PATCH(req: Request, ctx: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await ctx.params
  const body = await req.json().catch(() => null) ?? {}
  const reason = String(body.reason ?? body.cancelReason ?? '').trim()
  const replacementDocumentId = body.replacementDocumentId ? String(body.replacementDocumentId) : null
  if (reason.length < 10) return NextResponse.json({ error: 'Motivo do cancelamento é obrigatório e deve ter pelo menos 10 caracteres.' }, { status: 400 })

  const version = await prisma.documentVersion.findUnique({ where: { id: versionId }, include: { document: true } })
  if (!version) return NextResponse.json({ error: 'Versão do documento não encontrada.' }, { status: 404 })
  if (!(await canCancelDocument(me.id, version.documentId))) return NextResponse.json({ error: QUALITY_DOCUMENT_MANAGER_FORBIDDEN_MESSAGE }, { status: 403 })
  if (version.status === DocumentVersionStatus.PUBLICANDO) return NextResponse.json({ error: 'Não é possível cancelar enquanto a publicação está em andamento.' }, { status: 409 })
  if (version.status === DocumentVersionStatus.CANCELADO) return NextResponse.json({ error: 'Documento já está cancelado.' }, { status: 409 })
  if (!version.isCurrentPublished && (version.status === DocumentVersionStatus.PUBLICADO || version.status === DocumentVersionStatus.OBSOLETO)) {
    return NextResponse.json({ error: 'Versão histórica não pode ser cancelada. Use operação administrativa específica.' }, { status: 409 })
  }

  try {
    await validateReplacementDocument(replacementDocumentId, version.documentId)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Documento substituto inválido.' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await cancelDocumentApprovalFlow(tx, { versionId })
    await tx.documentVersion.update({ where: { id: versionId }, data: { status: DocumentVersionStatus.CANCELADO, isCurrentPublished: false, operationalUseBlocked: true, cancelledAt: new Date(), cancelledById: me.id, cancelReason: reason, replacementDocumentId } })
    if (version.isCurrentPublished || version.document.currentPublishedVersionId === versionId) {
      await tx.isoDocument.update({ where: { id: version.documentId }, data: { currentPublishedVersionId: null } })
    }
    await tx.documentAuditLog.create({ data: { documentId: version.documentId, versionId, userId: me.id, action: 'CANCEL', reason, metadata: { replacementDocumentId, wasCurrentPublished: version.isCurrentPublished } } })
  })

  void sendDocumentNotification('DOCUMENT_CANCELLED', { documentId: version.documentId, versionId, actorUserId: me.id, comment: reason }).catch((error) => console.error('DOCUMENT_CANCEL notification failed', error))
  return NextResponse.json({ ok: true, status: DocumentVersionStatus.CANCELADO })
}
