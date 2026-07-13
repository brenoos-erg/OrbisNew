import { NextRequest, NextResponse } from 'next/server'
import { DocumentApprovalStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendDocumentNotification } from '@/lib/documents/documentNotificationService'
import { hasDocumentPermission, getDocumentContextByDocumentId } from '@/lib/documents/documentRoleAccess'
import { startDocumentApprovalFlow } from '@/lib/documents/documentApprovalTransition'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  const { id } = await params

  const document = await prisma.isoDocument.findUnique({
    where: { id },
    include: { documentType: { include: { approvalFlowItems: { where: { active: true }, orderBy: { order: 'asc' }, include: { approverGroup: { include: { members: { include: { user: { select: { status: true } } } } } } } } } }, versions: { orderBy: { revisionNumber: 'desc' }, take: 1 } },
  })

  if (!document) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
  const permissionContext = await getDocumentContextByDocumentId(document.id)
  if (me.role !== 'ADMIN' && document.authorUserId !== me.id && !(await hasDocumentPermission(me.id, 'CAN_SUBMIT_FOR_APPROVAL', permissionContext))) {
    return NextResponse.json({ error: 'Apenas elaborador autorizado, autor ou administrador pode iniciar a publicação.' }, { status: 403 })
  }

  const version = document.versions[0]
  if (!version) return NextResponse.json({ error: 'Documento sem versão.' }, { status: 400 })
  if (version.status !== 'EM_ELABORACAO') return NextResponse.json({ error: 'Somente versões em elaboração podem ser enviadas para aprovação.' }, { status: 400 })
  const pendingRound = await prisma.documentApprovalRound.findFirst({ where: { versionId: version.id, status: 'PENDING' }, select: { id: true } })
  if (pendingRound) return NextResponse.json({ error: 'Já existe rodada de aprovação pendente para esta versão.' }, { status: 409 })

  const flow = document.documentType.approvalFlowItems
  if (!flow.length) return NextResponse.json({ error: 'Fluxo de aprovação não configurado para o tipo.' }, { status: 400 })

  await prisma.$transaction(async (tx) => {
    await tx.documentApproval.updateMany({ where: { versionId: version.id }, data: { status: DocumentApprovalStatus.PENDING, decidedById: null, decidedAt: null, comment: null } })
    await tx.documentApproval.createMany({
      data: flow.map((item) => ({
        versionId: version.id,
        flowItemId: item.id,
        status: DocumentApprovalStatus.PENDING,
      })),
      skipDuplicates: true,
    })
    await startDocumentApprovalFlow(tx, { versionId: version.id, flow })
  })

  void sendDocumentNotification('DOCUMENT_SUBMITTED_FOR_APPROVAL', {
    documentId: document.id,
    versionId: version.id,
    flowItemId: flow[0]?.id,
    actorUserId: me.id,
  }).catch((error) => console.error('DOCUMENT_SUBMITTED_FOR_APPROVAL notification failed', error))

  if (flow[0]?.stepType === 'QUALITY') {
    void sendDocumentNotification('DOCUMENT_QUALITY_REVIEW', {
      documentId: document.id,
      versionId: version.id,
      flowItemId: flow[0]?.id,
      actorUserId: me.id,
    }).catch((error) => console.error('DOCUMENT_QUALITY_REVIEW notification failed', error))
  }

  return NextResponse.json({ ok: true })
}
