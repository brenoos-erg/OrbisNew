import { DocumentVersionStatus } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import {
  QUALITY_DOCUMENT_MANAGER_FORBIDDEN_MESSAGE,
  requireQualityDocumentManager,
} from '@/lib/documents/documentManagementAccess'
import { prisma } from '@/lib/prisma'

const DEFAULT_CANCEL_REASON = 'Cancelamento formal realizado pelo setor de Qualidade.'

export async function PATCH(req: Request, ctx: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const access = await requireQualityDocumentManager(me.id)
  if (!access.canManage) {
    return NextResponse.json({ error: QUALITY_DOCUMENT_MANAGER_FORBIDDEN_MESSAGE }, { status: 403 })
  }

  const { versionId } = await ctx.params
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      status: true,
      documentId: true,
    },
  })

  if (!version) {
    return NextResponse.json({ error: 'Versão do documento não encontrada.' }, { status: 404 })
  }

  if (version.status === DocumentVersionStatus.CANCELADO) {
    return NextResponse.json({ error: 'Documento já está cancelado.' }, { status: 409 })
  }

  let reason = DEFAULT_CANCEL_REASON
  try {
    const body = await req.json()
    const informedReason = String(body?.reason ?? body?.motivo ?? '').trim()
    if (informedReason) reason = informedReason
  } catch {
    // O motivo padrão mantém a operação auditável mesmo para clientes antigos sem corpo JSON.
  }

  await prisma.$transaction(async (tx) => {
    await tx.documentVersion.update({
      where: { id: versionId },
      data: {
        status: DocumentVersionStatus.CANCELADO,
        isCurrentPublished: false,
        operationalUseBlocked: true,
        obsoleteAt: new Date(),
        obsoletedById: me.id,
        obsoleteReason: reason,
      },
    })

    await tx.documentAuditLog.create({
      data: {
        documentId: version.documentId,
        versionId: version.id,
        userId: me.id,
        action: 'CANCEL',
        reason,
      },
    })
  })

  return NextResponse.json({
    ok: true,
    status: DocumentVersionStatus.CANCELADO,
    reason,
  })
}
