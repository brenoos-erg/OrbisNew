import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import { PrintCopyType } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import { resolveDocumentVersionAccess } from '@/lib/documentVersionAccess'
import { resolveDocumentFileType } from '@/lib/documents/fileType'
import { convertWordToPdf } from '@/lib/documents/wordToPdf'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params

  const access = await resolveDocumentVersionAccess(versionId, me.id)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  if ('termChallenge' in access) return NextResponse.json(access.termChallenge, { status: access.status })

  await prisma.printCopy.create({
    data: {
      documentId: access.documentId,
      versionId: access.versionId,
      type: PrintCopyType.UNCONTROLLED,
      issuedById: me.id,
    },
  })

  await registerDocumentAuditLog({
    action: 'PRINT',
    documentId: access.documentId,
    versionId: access.versionId,
    userId: me.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent'),
  })
  const fileType = resolveDocumentFileType(access.fileUrl)
  let canRenderPdf = fileType.isPdf
  let conversionError: string | null = null

  if (fileType.isWord) {
    try {
      await convertWordToPdf({
        fileUrl: access.fileUrl,
        sourceAbsolutePath: path.join(process.cwd(), 'public', access.fileUrl.startsWith('/') ? access.fileUrl.slice(1) : access.fileUrl),
      })
      canRenderPdf = true
    } catch (error) {
      conversionError = 'Não foi possível converter este arquivo Word para impressão agora. Você pode baixar o original.'
      console.error('Falha ao preparar conversão Word para impressão.', {
        versionId,
        fileUrl: access.fileUrl,
        error,
      })
    }
  }
  const renderUrl = canRenderPdf
    ? `/api/documents/versions/${versionId}/file?disposition=inline&auditAction=PRINT${fileType.isWord ? '&format=pdf' : ''}`
    : undefined

  return NextResponse.json({
    ok: true,
    isPdf: canRenderPdf,
    fileExtension: fileType.extension,
    conversionError,
    url: renderUrl,
    downloadUrl: `/api/documents/versions/${versionId}/file?disposition=attachment&auditAction=PRINT`,
    document: {
      code: access.documentCode,
      title: access.documentTitle,
      revisionNumber: access.revisionNumber,
    },
  })
}