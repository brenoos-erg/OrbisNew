import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import { resolveDocumentFinalPdf } from '@/lib/documents/finalPdf'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params

  try {
    const resolved = await resolveDocumentFinalPdf(versionId, me.id, 'view')
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    if ('termChallenge' in resolved) return NextResponse.json(resolved.termChallenge, { status: resolved.status })

    await registerDocumentAuditLog({
      action: 'VIEW',
      documentId: resolved.access.documentId,
      versionId: resolved.access.versionId,
      userId: me.id,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent'),
    })

    const renderUrl = `/api/documents/versions/${versionId}/file?disposition=inline&auditAction=VIEW`

    return NextResponse.json({
      ok: true,
      isPdf: true,
      fileExtension: resolved.sourceExtension,
      url: renderUrl,
      downloadUrl: `/api/documents/versions/${versionId}/file?disposition=attachment&auditAction=VIEW`,
      document: {
        code: resolved.access.documentCode,
        title: resolved.access.documentTitle,
        revisionNumber: resolved.access.revisionNumber,
      },
    })
  } catch (error) {
    console.error('Falha ao preparar visualização via pipeline único.', { versionId, error })
    return NextResponse.json(
      { error: 'Não foi possível preparar o PDF final para visualização.' },
      { status: 422 },
    )
  }
}

