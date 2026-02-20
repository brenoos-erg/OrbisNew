import { NextRequest, NextResponse } from 'next/server'
import { DocumentApprovalStatus, DocumentFlowStepType, DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  const { id } = await params

  const document = await prisma.isoDocument.findUnique({
    where: { id },
    include: { documentType: { include: { approvalFlowItems: { where: { active: true }, orderBy: { order: 'asc' } } } }, versions: { orderBy: { revisionNumber: 'desc' }, take: 1 } },
  })

  if (!document) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
  if (me.role !== 'ADMIN' && document.authorUserId !== me.id) {
    return NextResponse.json({ error: 'Apenas o autor ou administrador pode iniciar a publicação.' }, { status: 403 })
  }

  const version = document.versions[0]
  if (!version) return NextResponse.json({ error: 'Documento sem versão.' }, { status: 400 })

  const flow = document.documentType.approvalFlowItems
  if (!flow.length) return NextResponse.json({ error: 'Fluxo de aprovação não configurado para o tipo.' }, { status: 400 })

  await prisma.$transaction([
    prisma.documentApproval.deleteMany({ where: { versionId: version.id } }),
    prisma.documentApproval.createMany({
      data: flow.map((item) => ({
        versionId: version.id,
        flowItemId: item.id,
        status: DocumentApprovalStatus.PENDING,
      })),
    }),
    prisma.documentVersion.update({
      where: { id: version.id },
      data: { status: flow[0].stepType === DocumentFlowStepType.QUALITY ? DocumentVersionStatus.EM_ANALISE_QUALIDADE : DocumentVersionStatus.EM_REVISAO },
    }),
  ])

  return NextResponse.json({ ok: true })
}
