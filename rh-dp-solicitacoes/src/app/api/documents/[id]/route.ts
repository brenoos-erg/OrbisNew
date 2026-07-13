import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { QUALITY_DOCUMENT_MANAGER_FORBIDDEN_MESSAGE } from '@/lib/documents/documentManagementAccess'
import { canDeleteDocumentByPostingError } from '@/lib/documents/documentRoleAccess'
import { cancelDocumentApprovalFlow } from '@/lib/documents/documentApprovalTransition'
import { prisma } from '@/lib/prisma'

const POSTING_ERROR_MARKER = 'POSTING_ERROR'
const DEFAULT_POSTING_ERROR_REASON = `${POSTING_ERROR_MARKER}: Exclusão por erro de postagem para liberar o código para novo cadastro sem nova revisão.`

function buildPostingErrorReason(reason: string) {
  const trimmed = reason.trim()
  return trimmed.includes(POSTING_ERROR_MARKER) ? trimmed : `${POSTING_ERROR_MARKER}: ${trimmed}`
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const me = await requireActiveUser()
    const { id } = await ctx.params

    const document = await prisma.isoDocument.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        isActive: true,
        printCopies: { take: 1, select: { id: true } },
        downloadLogs: { take: 1, select: { id: true } },
        distributions: { take: 1, select: { id: true } },
        versions: {
          orderBy: [{ isCurrentPublished: 'desc' }, { revisionNumber: 'desc' }, { createdAt: 'desc' }],
          select: { id: true, revisionNumber: true, status: true, downloadLogs: { take: 1, select: { id: true } }, readReceipts: { take: 1, select: { id: true } }, printCopies: { take: 1, select: { id: true } }, distributions: { take: 1, select: { id: true } }, termActionAcceptances: { take: 1, select: { id: true } } },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
    }

    if (!(await canDeleteDocumentByPostingError(me.id, id))) {
      return NextResponse.json({ error: QUALITY_DOCUMENT_MANAGER_FORBIDDEN_MESSAGE }, { status: 403 })
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

    const hasOperationalUse = document.printCopies.length > 0 || document.downloadLogs.length > 0 || document.distributions.length > 0 || document.versions.some((version) => version.downloadLogs.length || version.readReceipts.length || version.printCopies.length || version.distributions.length || version.termActionAcceptances.length)
    if (hasOperationalUse) {
      return NextResponse.json(
        { error: 'Documento já possui uso operacional. Utilize cancelamento formal.' },
        { status: 409 },
      )
    }

    if (document.versions.length > 1) {
      return NextResponse.json(
        { error: 'Documento possui revisões posteriores ou múltiplas versões. Utilize cancelamento formal.' },
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
          inactiveById: me.id, // inactiveById: ctx.me.id
          inactiveReason,
        },
      })
      await tx.isoDocument.update({ where: { id }, data: { currentPublishedVersionId: null } })

      await tx.documentVersion.updateMany({
        where: { documentId: id },
        data: {
          status: 'CANCELADO',
          isCurrentPublished: false,
          operationalUseBlocked: true,
          obsoleteAt: new Date(),
          obsoletedById: me.id, // obsoletedById: ctx.me.id
          obsoleteReason: inactiveReason,
        },
      })

      const mainVersion = document.versions[0]
      if (mainVersion) {
        await cancelDocumentApprovalFlow(tx, { versionId: mainVersion.id })
        await tx.documentAuditLog.create({
          data: { documentId: id, versionId: mainVersion.id, userId: me.id, action: 'CANCEL', reason: inactiveReason },
        })
      }
    })

    return NextResponse.json({
      ok: true,
      deletionType: POSTING_ERROR_MARKER,
      codeReleased: true,
      message: `Documento ${document.code} marcado como excluído por erro de postagem. Código liberado para novo cadastro sem gerar revisão.`,
    })
}
