import { NextRequest, NextResponse } from 'next/server'
import { PrintCopyType } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import { resolveDocumentFinalPdf } from '@/lib/documents/finalPdf'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params

  try {
    const resolved = await resolveDocumentFinalPdf(versionId, me.id, 'print')
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    if ('termChallenge' in resolved) return NextResponse.json(resolved.termChallenge, { status: resolved.status })

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const userAgent = req.headers.get('user-agent')

    await prisma.printCopy.create({
      data: {
        documentId: resolved.access.documentId,
        versionId: resolved.access.versionId,
        type: PrintCopyType.UNCONTROLLED,
        issuedById: me.id,
      },
    })

    await registerDocumentAuditLog({
      action: 'PRINT',
      documentId: resolved.access.documentId,
      versionId: resolved.access.versionId,
      userId: me.id,
      ip,
      userAgent,
    })

    return NextResponse.json({
      ok: true,
      isPdf: true,
      fileExtension: resolved.sourceExtension,
      url: `/api/documents/versions/${versionId}/file?disposition=inline&auditAction=PRINT`,
      downloadUrl: `/api/documents/versions/${versionId}/file?disposition=attachment&auditAction=PRINT`,
      document: {
        code: resolved.access.documentCode,
        title: resolved.access.documentTitle,
        revisionNumber: resolved.access.revisionNumber,
      },
    })
  } catch (error) {
    console.error('Falha ao preparar impressão via pipeline único.', { versionId, error })
    return NextResponse.json({ error: 'Não foi possível preparar o PDF final para impressão.' }, { status: 422 })
  }
}