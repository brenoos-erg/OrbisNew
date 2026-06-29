import { DocumentVersionStatus, ModuleLevel } from '@prisma/client'
import { NextResponse } from 'next/server'
import { withModuleLevel } from '@/lib/access'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { prisma } from '@/lib/prisma'

export const DELETE = withModuleLevel(
  MODULE_KEYS.CONTROLE_DOCUMENTOS,
  ModuleLevel.NIVEL_3,
  async (req, ctx) => {
    const { id } = await ctx.params

    const exists = await prisma.isoDocument.findUnique({
      where: { id },
      select: { id: true, versions: { orderBy: [{ isCurrentPublished: 'desc' }, { revisionNumber: 'desc' }], take: 1, select: { id: true } } },
    })

    if (!exists) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
    }

    let reason = 'Cancelamento via endpoint DELETE com preservação de histórico.'
    try {
      const body = await req.json()
      reason = String(body?.reason ?? body?.motivo ?? reason).trim() || reason
    } catch {
      // DELETE pode não enviar corpo; usa motivo padrão auditável.
    }

    const versionId = exists.versions[0]?.id
    await prisma.$transaction(async (tx) => {
      await tx.isoDocument.update({
        where: { id },
        data: { isActive: false, inactiveAt: new Date(), inactiveById: ctx.me.id, inactiveReason: reason },
      })

      if (versionId) {
        await tx.documentVersion.update({
          where: { id: versionId },
          data: {
            status: DocumentVersionStatus.CANCELADO,
            isCurrentPublished: false,
            obsoleteAt: new Date(),
            obsoletedById: ctx.me.id,
            obsoleteReason: reason,
            operationalUseBlocked: true,
          },
        })
        await tx.documentAuditLog.create({
          data: { documentId: id, versionId, userId: ctx.me.id, action: 'CANCEL', reason },
        })
      }
    })

    return NextResponse.json({ ok: true, status: DocumentVersionStatus.CANCELADO })
  },
)
