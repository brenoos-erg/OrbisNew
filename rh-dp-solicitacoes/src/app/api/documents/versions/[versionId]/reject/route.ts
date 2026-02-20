import { NextRequest, NextResponse } from 'next/server'
import { DocumentApprovalStatus, DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const { comment } = await req.json().catch(() => ({ comment: null }))

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

  return NextResponse.json({ ok: true })
}