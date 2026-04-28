import { NextRequest, NextResponse } from 'next/server'
import { DocumentApprovalStatus, DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { canApproveDocumentStage } from '@/lib/documentApprovalControl'
import { prisma } from '@/lib/prisma'
import { sendDocumentNotification } from '@/lib/documents/documentNotificationService'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const { comment } = await req.json().catch(() => ({ comment: null }))

  const version = await prisma.documentVersion.findUnique({ where: { id: versionId }, select: { status: true } })
  if (!version) return NextResponse.json({ error: 'Versão não encontrada.' }, { status: 404 })

  const stage = version.status === DocumentVersionStatus.AG_APROVACAO ? 2 : version.status === DocumentVersionStatus.EM_ANALISE_QUALIDADE ? 3 : null
  if (!stage) return NextResponse.json({ error: 'Esta versão não está em etapa de aprovação.' }, { status: 400 })

  const canApprove = await canApproveDocumentStage(me.id, stage, me.role)
  if (!canApprove) return NextResponse.json({ error: 'Você não possui permissão para reprovar nesta etapa.' }, { status: 403 })

  const approval = await prisma.documentApproval.findFirst({
    where: { versionId, status: DocumentApprovalStatus.PENDING },
    orderBy: { flowItem: { order: 'asc' } },
  })

  if (!approval) return NextResponse.json({ error: 'Não há etapa pendente.' }, { status: 400 })

  await prisma.$transaction([
    prisma.documentApproval.update({
      where: { id: approval.id },
      data: { status: DocumentApprovalStatus.REJECTED, decidedById: me.id, decidedAt: new Date(), comment },
    }),
    prisma.documentVersion.update({ where: { id: versionId }, data: { status: DocumentVersionStatus.EM_ELABORACAO } }),
  ])

  const documentId = (
    await prisma.documentVersion.findUnique({ where: { id: versionId }, select: { documentId: true } })
  )?.documentId

  if (documentId) {
    void sendDocumentNotification('DOCUMENT_REJECTED', {
      documentId,
      versionId,
      flowItemId: approval.flowItemId,
      actorUserId: me.id,
      comment: typeof comment === 'string' ? comment : null,
    }).catch((error) => console.error('DOCUMENT_REJECTED notification failed', error))
  }

  return NextResponse.json({ ok: true })
}
