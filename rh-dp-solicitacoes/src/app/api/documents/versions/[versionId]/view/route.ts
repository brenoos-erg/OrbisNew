import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import { requireActiveUser } from '@/lib/auth'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import { resolveDocumentVersionAccess } from '@/lib/documentVersionAccess'
import { resolveDocumentFileType } from '@/lib/documents/fileType'
import { convertDocumentToPdf } from '@/lib/documents/wordToPdf'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const access = await resolveDocumentVersionAccess(versionId, me.id, 'view')
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  if ('termChallenge' in access) return NextResponse.json(access.termChallenge, { status: access.status })

  await registerDocumentAuditLog({
    action: 'VIEW',
    documentId: access.documentId,
    versionId: access.versionId,
    userId: me.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent'),
  })

  const fileType = resolveDocumentFileType(access.fileUrl)
  let conversionError: string | null = null

  if (!fileType.isPdf && fileType.isConvertibleToPdf) {
    try {
      await convertDocumentToPdf({
        fileUrl: access.fileUrl,
        sourceAbsolutePath: path.join(process.cwd(), 'public', access.fileUrl.startsWith('/') ? access.fileUrl.slice(1) : access.fileUrl),
      })
    } catch (error) {
      conversionError = 'Não foi possível converter este arquivo para PDF para visualização agora.'
      console.error('Falha ao preparar conversão para visualização em PDF.', {
        versionId,
        fileUrl: access.fileUrl,
        error,
      })
      return NextResponse.json({ error: conversionError }, { status: 422 })
    }
  }
  const canRenderPdf = fileType.isPdf || fileType.isConvertibleToPdf
  const renderUrl = canRenderPdf
    ? `/api/documents/versions/${versionId}/file?disposition=inline&auditAction=VIEW`
    : undefined

  return NextResponse.json({
    ok: true,
    isPdf: canRenderPdf,
    fileExtension: fileType.extension,
    conversionError,
    url: renderUrl,
    downloadUrl: `/api/documents/versions/${versionId}/file?disposition=attachment&auditAction=VIEW`,
     document: {
      code: access.documentCode,
      title: access.documentTitle,
      revisionNumber: access.revisionNumber,
    },
  })
}

