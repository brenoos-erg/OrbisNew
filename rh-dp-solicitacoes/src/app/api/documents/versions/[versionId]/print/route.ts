import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import { PrintCopyType } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import { resolveDocumentVersionAccess } from '@/lib/documentVersionAccess'
import { resolveDocumentFileType } from '@/lib/documents/fileType'
import { convertDocumentToPdf } from '@/lib/documents/wordToPdf'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params

  const access = await resolveDocumentVersionAccess(versionId, me.id, 'print')
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  if ('termChallenge' in access) return NextResponse.json(access.termChallenge, { status: access.status })

  const fileType = resolveDocumentFileType(access.fileUrl)

  if (!fileType.isPdf && !fileType.isConvertibleToPdf) {
    return NextResponse.json(
      {
        error: `Formato ${fileType.extension || 'desconhecido'} não suportado para impressão final em PDF.`,
      },
      { status: 422 },
    )
  }

  if (!fileType.isPdf) {
    try {
      await convertDocumentToPdf({
        fileUrl: access.fileUrl,
        sourceAbsolutePath: path.join(process.cwd(), 'public', access.fileUrl.startsWith('/') ? access.fileUrl.slice(1) : access.fileUrl),
      })
    } catch (error) {
      console.error('Falha ao preparar conversão para impressão em PDF.', {
        versionId,
        fileUrl: access.fileUrl,
        error,
      })
      return NextResponse.json(
        { error: 'Não foi possível converter este arquivo para PDF para impressão agora.' },
        { status: 422 },
      )
    }
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = req.headers.get('user-agent')

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
    ip,
    userAgent,
  })
  const renderUrl = `/api/documents/versions/${versionId}/file?disposition=inline&auditAction=PRINT`

  return NextResponse.json({
    ok: true,
    isPdf: true,
    fileExtension: fileType.extension,
    url: renderUrl,
    downloadUrl: `/api/documents/versions/${versionId}/file?disposition=attachment&auditAction=PRINT`,
    document: {
      code: access.documentCode,
      title: access.documentTitle,
      revisionNumber: access.revisionNumber,
    },
  })
}