import { DocumentApprovalRoundStatus, DocumentApprovalStepStatus, DocumentVersionStatus, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canPublishDocument, getDocumentContextByVersionId, hasDocumentPermission } from '@/lib/documents/documentRoleAccess'
import { DocumentPublishPipelineError, finalizeToPublishedPdf } from '@/lib/documents/finalizeToPublishedPdf'
import { resolveDocumentFamilyRule } from '@/lib/documents/documentFamilyRules'
import { copyAbsolutePathToPublished, copyPrivateDocumentSourceToPublished, removePrivateDocumentPublishedFile, resolvePublicDocumentPath } from '@/lib/documents/documentStorage'
import { sendDocumentNotification } from '@/lib/documents/documentNotificationService'
import path from 'node:path'

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

export class DocumentPublicationError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, unknown>) {
    super(message)
  }
}

async function generatePublishedFile(version: Awaited<ReturnType<typeof loadPublishVersion>>) {
  if (!version) throw new DocumentPublicationError(404, 'Versão não encontrada.')
  const sourceFileUrl = version.sourceStorageKey ?? version.sourceFileUrl ?? version.fileUrl
  if (!sourceFileUrl) throw new DocumentPublicationError(422, 'A versão não possui arquivo original para publicação.')
  const familyRule = resolveDocumentFamilyRule(version.document.code)
  if (familyRule.family !== 'controlled-pdf') {
    if (version.sourceStorageKey) return copyPrivateDocumentSourceToPublished(version.sourceStorageKey, path.extname(version.sourceOriginalName || version.sourceStorageKey) || '.bin')
    const resolved = await resolvePublicDocumentPath(sourceFileUrl)
    if (!resolved.exists) throw new DocumentPublicationError(404, 'Arquivo original legado não encontrado para publicação.')
    return copyAbsolutePathToPublished(resolved.absolutePath, path.extname(sourceFileUrl) || '.bin')
  }
  try {
    const fileUrl = await finalizeToPublishedPdf({ sourceFileUrl, documentCode: version.document.code, revisionNumber: version.revisionNumber })
    const resolved = await resolvePublicDocumentPath(fileUrl)
    if (!resolved.exists) throw new DocumentPublicationError(404, 'PDF oficial gerado não encontrado para armazenamento publicado.')
    return copyAbsolutePathToPublished(resolved.absolutePath, '.pdf')
  } catch (error) {
    if (error instanceof DocumentPublishPipelineError) throw new DocumentPublicationError(422, `Falha ao gerar PDF oficial: ${error.message}`)
    throw new DocumentPublicationError(422, 'Não foi possível gerar o arquivo oficial de publicação.')
  }
}

async function loadPublishVersion(versionId: string) {
  return prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: true, approvalRounds: { orderBy: { roundNumber: 'desc' }, take: 1, include: { steps: true } }, approvalSteps: { include: { decisions: true } }, qualityChecklists: true, segregationExceptions: true },
  })
}

export async function publishDocumentVersion(input: { versionId: string; actorUserId: string; justification?: string | null; directPublication?: boolean; segregationExceptionId?: string | null }) {
  const version = await loadPublishVersion(input.versionId)
  if (!version) throw new DocumentPublicationError(404, 'Versão não encontrada.')
  if (!(await canPublishDocument(input.actorUserId, input.versionId))) throw new DocumentPublicationError(403, 'Você não possui papel de publicador documental para publicar esta versão.')
  if (input.directPublication && !(await hasDocumentPermission(input.actorUserId, 'CAN_DIRECT_PUBLISH', await getDocumentContextByVersionId(input.versionId)))) throw new DocumentPublicationError(403, 'Publicação direta exige permissão CAN_DIRECT_PUBLISH.')
  if (version.status === DocumentVersionStatus.PUBLICADO && version.publishedFileUrl) return { ok: true, idempotent: true, notified: false, publishedFileUrl: version.publishedFileUrl }
  if (version.status !== DocumentVersionStatus.AGUARDANDO_PUBLICACAO) throw new DocumentPublicationError(400, 'Versão não está aguardando publicação.')
  const latestRound = version.approvalRounds?.[0]
  const satisfiedStepStatuses = new Set<DocumentApprovalStepStatus>([DocumentApprovalStepStatus.APPROVED, DocumentApprovalStepStatus.WAIVED])
  if (!input.directPublication && (!latestRound || latestRound.status !== DocumentApprovalRoundStatus.APPROVED || latestRound.steps.some((step) => !satisfiedStepStatuses.has(step.status)))) throw new DocumentPublicationError(409, 'Última rodada de aprovação não está concluída.')
  if (latestRound?.steps.some((step) => new Set<DocumentApprovalStepStatus>([DocumentApprovalStepStatus.PENDING, DocumentApprovalStepStatus.REJECTED, DocumentApprovalStepStatus.CANCELLED]).has(step.status))) throw new DocumentPublicationError(409, 'Existem etapas de aprovação pendentes, rejeitadas ou canceladas.')
  if (latestRound?.steps.some((step) => step.stepType === 'QUALITY' && step.status === DocumentApprovalStepStatus.APPROVED) && !version.qualityChecklists.some((item) => item.roundId === latestRound.id && item.completedAt && item.result === 'APPROVED')) {
    throw new DocumentPublicationError(409, 'Checklist da Qualidade pendente.')
  }
  if (version.document.authorUserId === input.actorUserId) {
    const approvedException = version.segregationExceptions.find((item) => item.id === input.segregationExceptionId && item.conflictType === 'SELF_PUBLICATION' && item.status === 'APPROVED' && item.decidedById && item.decidedById !== input.actorUserId)
    if (!approvedException) {
      const pendingKey = `${version.id}:SELF_PUBLICATION:${input.actorUserId}`
      let exception = await prisma.documentSegregationException.findUnique({ where: { pendingKey } })
      if (!exception) {
        exception = await prisma.documentSegregationException.create({ data: { documentId: version.documentId, versionId: version.id, conflictType: 'SELF_PUBLICATION', requestedById: input.actorUserId, justification: input.justification || 'Solicitação de exceção para autopublicação.', pendingKey } })
        await prisma.documentAuditLog.create({ data: { documentId: version.documentId, versionId: version.id, userId: input.actorUserId, action: 'SEGREGATION_EXCEPTION_REQUESTED', reason: input.justification || null, metadata: { exceptionId: exception.id, conflictType: 'SELF_PUBLICATION' } } })
        await sendDocumentNotification('SEGREGATION_EXCEPTION_REQUESTED', { documentId: version.documentId, versionId: version.id, actorUserId: input.actorUserId }).catch((error) => console.error('SEGREGATION_EXCEPTION_REQUESTED notification failed', error))
      }
      throw new DocumentPublicationError(409, 'Autopublicação exige exceção aprovada por outro gestor documental.', { exceptionId: exception.id })
    }
  }

  const claimed = await prisma.documentVersion.updateMany({ where: { id: input.versionId, status: DocumentVersionStatus.AGUARDANDO_PUBLICACAO, isCurrentPublished: false }, data: { status: DocumentVersionStatus.PUBLICANDO, operationalUseBlocked: true } })
  if (claimed.count !== 1) throw new DocumentPublicationError(409, 'Publicação concorrente detectada. Recarregue a versão.')

  let publishedFile: Awaited<ReturnType<typeof generatePublishedFile>> | null = null
  try {
    publishedFile = await generatePublishedFile(version)
  } catch (error) {
    await prisma.documentVersion.updateMany({ where: { id: input.versionId, status: DocumentVersionStatus.PUBLICANDO }, data: { status: DocumentVersionStatus.AGUARDANDO_PUBLICACAO, operationalUseBlocked: false } })
    throw error
  }
  try {
  await prisma.$transaction(async (tx: Tx) => {
    const previousCurrentId = version.document.currentPublishedVersionId
    await tx.documentVersion.updateMany({ where: { documentId: version.documentId, isCurrentPublished: true, id: { not: version.id } }, data: { isCurrentPublished: false, status: DocumentVersionStatus.OBSOLETO, obsoleteAt: new Date(), obsoleteReason: 'Substituído por nova revisão publicada.', obsoletedById: input.actorUserId, operationalUseBlocked: true } })
    if (previousCurrentId && previousCurrentId !== version.id) {
      await tx.documentVersion.updateMany({ where: { id: previousCurrentId }, data: { isCurrentPublished: false, status: DocumentVersionStatus.OBSOLETO, obsoleteAt: new Date(), obsoleteReason: 'Substituído por nova revisão publicada.', obsoletedById: input.actorUserId, operationalUseBlocked: true } })
    }
    const finalized = await tx.documentVersion.updateMany({
      where: { id: version.id, status: DocumentVersionStatus.PUBLICANDO },
      data: {
        status: DocumentVersionStatus.PUBLICADO,
        publishedFileUrl: publishedFile.fileUrl,
        publishedStorageKey: publishedFile.storageKey,
        publishedOriginalName: publishedFile.originalName,
        publishedMimeType: publishedFile.mimeType,
        publishedSizeBytes: publishedFile.sizeBytes,
        publishedSha256: publishedFile.sha256,
        fileUrl: publishedFile.fileUrl,
        publishedAt: new Date(),
        isCurrentPublished: true,
        operationalUseBlocked: false,
      },
    })
    if (finalized.count !== 1) throw new DocumentPublicationError(409, 'Publicação concorrente detectada ao finalizar.')
    await tx.isoDocument.update({ where: { id: version.documentId }, data: { currentPublishedVersionId: version.id } })
    await tx.documentAuditLog.create({ data: { documentId: version.documentId, versionId: version.id, userId: input.actorUserId, action: input.directPublication ? 'DIRECT_PUBLICATION' : 'PUBLISHED', reason: input.justification || null } })
  })
  } catch (error) {
    if (publishedFile?.storageKey) await removePrivateDocumentPublishedFile(publishedFile.storageKey).catch(() => undefined)
    await prisma.documentVersion.updateMany({ where: { id: input.versionId, status: DocumentVersionStatus.PUBLICANDO }, data: { status: DocumentVersionStatus.AGUARDANDO_PUBLICACAO, operationalUseBlocked: false } })
    throw error
  }
  return { ok: true, idempotent: false, notified: true, publishedFileUrl: publishedFile.fileUrl }
}
