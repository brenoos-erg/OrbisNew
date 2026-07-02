import { ModuleLevel } from '@prisma/client'
import { NextResponse } from 'next/server'
import { withModuleLevel } from '@/lib/access'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { prisma } from '@/lib/prisma'

const POSTING_ERROR_MARKER = 'POSTING_ERROR'
const DEFAULT_POSTING_ERROR_REASON = `${POSTING_ERROR_MARKER}: Exclusão por erro de postagem para liberar o código para novo cadastro sem nova revisão.`

function buildPostingErrorReason(reason: string) {
  const trimmed = reason.trim()
  return trimmed.includes(POSTING_ERROR_MARKER) ? trimmed : `${POSTING_ERROR_MARKER}: ${trimmed}`
}

export const DELETE = withModuleLevel(
  MODULE_KEYS.CONTROLE_DOCUMENTOS,
  ModuleLevel.NIVEL_3,
  async (req, ctx) => {
    const { id } = await ctx.params

    const document = await prisma.isoDocument.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        isActive: true,
        versions: {
          orderBy: [{ isCurrentPublished: 'desc' }, { revisionNumber: 'desc' }, { createdAt: 'desc' }],
          select: { id: true, revisionNumber: true, status: true },
        },
        printCopies: { take: 1, select: { id: true } },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
    }

    let reason = DEFAULT_POSTING_ERROR_REASON
    try {
      const body = await req.json()
      reason = String(body?.reason ?? body?.motivo ?? reason).trim() || reason
    } catch {
      // DELETE pode não enviar corpo; usa motivo padrão auditável.
    }

    if (!reason || reason.length < 5) {
      return NextResponse.json({ error: 'Informe o motivo da exclusão por erro de postagem.' }, { status: 400 })
    }

    if (document.printCopies.length > 0) {
      return NextResponse.json(
        { error: 'Documento possui cópia impressa registrada. Use cancelamento formal para preservar rastreabilidade.' },
        { status: 409 },
      )
    }

    const inactiveReason = buildPostingErrorReason(reason)
    await prisma.$transaction(async (tx) => {
      await tx.isoDocument.update({
        where: { id },
        data: {
          isActive: false,
          activeCode: null,
          inactiveAt: new Date(),
          inactiveById: ctx.me.id,
          inactiveReason,
        },
      })

      await tx.documentVersion.updateMany({
        where: { documentId: id },
        data: {
          isCurrentPublished: false,
          operationalUseBlocked: true,
          obsoleteAt: new Date(),
          obsoletedById: ctx.me.id,
          obsoleteReason: inactiveReason,
        },
      })

      const mainVersion = document.versions[0]
      if (mainVersion) {
        await tx.documentAuditLog.create({
          data: { documentId: id, versionId: mainVersion.id, userId: ctx.me.id, action: 'CANCEL', reason: inactiveReason },
        })
      }
    })

    return NextResponse.json({
      ok: true,
      deletionType: POSTING_ERROR_MARKER,
      codeReleased: true,
      message: `Documento ${document.code} marcado como excluído por erro de postagem. Código liberado para novo cadastro sem gerar revisão.`,
    })
  },
)
