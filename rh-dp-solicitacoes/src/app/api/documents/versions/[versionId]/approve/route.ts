import { NextRequest, NextResponse } from 'next/server'
import { DocumentApprovalStatus, DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { canApproveDocumentStage } from '@/lib/documentApprovalControl'
import { prisma } from '@/lib/prisma'
import { notifyDocumentPublished } from '@/lib/isoDocumentNotifications'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params

  const version = await prisma.documentVersion.findUnique({ where: { id: versionId }, select: { id: true, status: true } })
  if (!version) return NextResponse.json({ error: 'Versão não encontrada.' }, { status: 404 })

  const stage = version.status === DocumentVersionStatus.AG_APROVACAO ? 2 : version.status === DocumentVersionStatus.EM_ANALISE_QUALIDADE ? 3 : null
  if (!stage) return NextResponse.json({ error: 'Esta versão não está em etapa de aprovação.' }, { status: 400 })

  const canApprove = await canApproveDocumentStage(me.id, stage)
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

  await prisma.$transaction([
    prisma.documentApproval.update({
      where: { id: approval.id },
      data: { status: DocumentApprovalStatus.APPROVED, decidedById: me.id, decidedAt: new Date() },
    }),
    prisma.documentVersion.update({
      where: { id: versionId },
      data: {
        status: nextStatus,
        publishedAt: nextStatus === DocumentVersionStatus.PUBLICADO ? new Date() : undefined,
        isCurrentPublished: nextStatus === DocumentVersionStatus.PUBLICADO ? true : undefined,
      },
    }),
  ])

  if (nextStatus === DocumentVersionStatus.PUBLICADO) {
    const mailResult = await notifyDocumentPublished(versionId)
    if (!mailResult.sent) {
      console.warn('Document publication alert not sent', { versionId, reason: mailResult.reason })
    }
  }

  return NextResponse.json({ ok: true })
}