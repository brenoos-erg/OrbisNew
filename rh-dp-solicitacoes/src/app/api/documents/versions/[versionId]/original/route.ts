import fs from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'

import { requireActiveUser } from '@/lib/auth'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import {
  QUALITY_DOCUMENT_MANAGER_FORBIDDEN_MESSAGE,
  requireQualityDocumentManager,
} from '@/lib/documents/documentManagementAccess'
import {
  buildContentDispositionHeader,
  buildDocumentDownloadFilename,
} from '@/lib/documents/documentDownloadFilename'
import { resolveDocumentFileType } from '@/lib/documents/fileType'
import { resolvePublicDocumentPath } from '@/lib/documents/documentStorage'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const me = await requireActiveUser()
  const access = await requireQualityDocumentManager(me.id)

  if (!access.canManage) {
    return NextResponse.json(
      { error: QUALITY_DOCUMENT_MANAGER_FORBIDDEN_MESSAGE },
      { status: 403 },
    )
  }

  const { versionId } = await params
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      fileUrl: true,
      revisionNumber: true,
      document: {
        select: {
          id: true,
          code: true,
          title: true,
        },
      },
    },
  })

  if (!version?.fileUrl) {
    return NextResponse.json(
      { error: 'Arquivo original da versão não encontrado.' },
      { status: 404 },
    )
  }

  const resolvedPath = await resolvePublicDocumentPath(version.fileUrl)
  if (!resolvedPath.exists) {
    return NextResponse.json(
      { error: 'Arquivo físico original não encontrado no servidor.' },
      { status: 404 },
    )
  }

  try {
    const buffer = await fs.readFile(resolvedPath.absolutePath)
    const fileType = resolveDocumentFileType(version.fileUrl)
    const filename = buildDocumentDownloadFilename({
      code: version.document.code,
      title: version.document.title,
      revisionNumber: version.revisionNumber,
      mimeType: fileType.mimeType,
      storedPath: version.fileUrl,
      originalFilename: path.basename(version.fileUrl),
    })

    await registerDocumentAuditLog({
      action: 'DOWNLOAD',
      documentId: version.document.id,
      versionId: version.id,
      userId: me.id,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent'),
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': fileType.mimeType,
        'Content-Disposition': buildContentDispositionHeader(filename),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Document-Copy-Type': 'ORIGINAL',
      },
    })
  } catch (error) {
    console.error('[documents.original-download] failed', {
      versionId,
      userId: me.id,
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Não foi possível baixar o arquivo original.' },
      { status: 500 },
    )
  }
}
