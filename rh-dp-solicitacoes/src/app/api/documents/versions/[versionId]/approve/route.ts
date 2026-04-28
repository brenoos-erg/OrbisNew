import { NextRequest, NextResponse } from 'next/server'
import { DocumentApprovalStatus, DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { canApproveDocumentStage } from '@/lib/documentApprovalControl'
import { prisma } from '@/lib/prisma'
import { DocumentPublishPipelineError, finalizeToPublishedPdf } from '@/lib/documents/finalizeToPublishedPdf'
import { resolveDocumentFamilyRule } from '@/lib/documents/documentFamilyRules'
import { sendDocumentNotification } from '@/lib/documents/documentNotificationService'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      status: true,
      fileUrl: true,
      document: { select: { code: true } },
    },
  })
  if (!version) return NextResponse.json({ error: 'Versão não encontrada.' }, { status: 404 })

  const stage = version.status === DocumentVersionStatus.AG_APROVACAO ? 2 : version.status === DocumentVersionStatus.EM_ANALISE_QUALIDADE ? 3 : null
  if (!stage) return NextResponse.json({ error: 'Esta versão não está em etapa de aprovação.' }, { status: 400 })

  const canApprove = await canApproveDocumentStage(me.id, stage, me.role)
  if (!canApprove) return NextResponse.json({ error: 'Você não possui permissão para aprovar nesta etapa.' }, { status: 403 })

  const approval = await prisma.documentApproval.findFirst({
    where: { versionId, status: DocumentApprovalStatus.PENDING },
    orderBy: { flowItem: { order: 'asc' } },
    include: { flowItem: { select: { order: true } } },
  })

 if (!approval) return NextResponse.json({ error: 'Não há etapa pendente.' }, { status: 400 })

  const nextStatus = stage === 2
    ? DocumentVersionStatus.EM_ANALISE_QUALIDADE
    : DocumentVersionStatus.PUBLICADO

  let publishedFileUrl: string | undefined
  if (nextStatus === DocumentVersionStatus.PUBLICADO) {
    if (!version.fileUrl) {
      return NextResponse.json({ error: 'A versão não possui arquivo para publicação.' }, { status: 422 })
    }
    const familyRule = resolveDocumentFamilyRule(version.document.code)
    const shouldFinalizeToPdf = familyRule.family === 'controlled-pdf'

    try {
      console.info('[documents.approve] publication-flow-selected', {
        versionId,
        documentCode: version.document.code,
        prefix: familyRule.prefix,
        family: familyRule.family,
        sourceFileUrl: version.fileUrl,
        shouldFinalizeToPdf,
      })

      publishedFileUrl = shouldFinalizeToPdf
        ? await finalizeToPublishedPdf({
          sourceFileUrl: version.fileUrl,
          documentCode: version.document.code,
        })
        : version.fileUrl
      console.info('[documents.approve] publication-file-finalized', {
        versionId,
        documentCode: version.document.code,
        family: familyRule.family,
        sourceFileUrl: version.fileUrl,
        publishedFileUrl,
      })
    } catch (error) {
      console.error('Falha ao finalizar versão em PDF com marca d\'água no momento da publicação.', {
        versionId,
        fileUrl: version.fileUrl,
        documentCode: version.document.code,
        error,
      })
      if (error instanceof DocumentPublishPipelineError) {
        const reasonMessage = {
          CONVERSION: 'Falha de conversão Word -> PDF para publicação.',
          NOT_FOUND: 'Arquivo da versão não encontrado para publicação.',
          WATERMARK: 'Falha ao aplicar marca d’água no PDF final da publicação.',
          RULE: 'Regra inválida para o tipo documental na publicação.',
        }[error.reason]
        return NextResponse.json({ error: `${reasonMessage} Detalhes: ${error.message}` }, { status: 422 })
      }
      return NextResponse.json({ error: 'Não foi possível converter/aplicar marca d\'água ao PDF final para publicação.' }, { status: 422 })
    }
  }


  await prisma.$transaction([
    prisma.documentApproval.update({
      where: { id: approval.id },
      data: { status: DocumentApprovalStatus.APPROVED, decidedById: me.id, decidedAt: new Date() },
    }),
    prisma.documentVersion.update({
      where: { id: versionId },
      data: {
        status: nextStatus,
        fileUrl: publishedFileUrl,
        publishedAt: nextStatus === DocumentVersionStatus.PUBLICADO ? new Date() : undefined,
        isCurrentPublished: nextStatus === DocumentVersionStatus.PUBLICADO ? true : undefined,
      },
    }),
  ])

  const documentId = (
    await prisma.documentVersion.findUnique({ where: { id: versionId }, select: { documentId: true } })
  )?.documentId

  if (documentId) {
    void sendDocumentNotification('DOCUMENT_APPROVED', {
      documentId,
      versionId,
      flowItemId: approval.flowItemId,
      actorUserId: me.id,
    }).catch((error) => console.error('DOCUMENT_APPROVED notification failed', error))

    if (nextStatus === DocumentVersionStatus.EM_ANALISE_QUALIDADE) {
      void sendDocumentNotification('DOCUMENT_QUALITY_REVIEW', {
        documentId,
        versionId,
        actorUserId: me.id,
      }).catch((error) => console.error('DOCUMENT_QUALITY_REVIEW notification failed', error))
    }
  }

  if (nextStatus === DocumentVersionStatus.PUBLICADO) {
    if (documentId) {
      void sendDocumentNotification('DOCUMENT_PUBLISHED', {
        documentId,
        versionId,
        actorUserId: me.id,
      }).catch((error) => console.error('DOCUMENT_PUBLISHED notification failed', error))
    }
  }

  return NextResponse.json({ ok: true })
}
