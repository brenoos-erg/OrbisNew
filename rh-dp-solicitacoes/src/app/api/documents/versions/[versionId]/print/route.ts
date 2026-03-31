import { NextRequest, NextResponse } from 'next/server'
import { PrintCopyType } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import { resolveDocumentVersionAccess } from '@/lib/documentVersionAccess'
import { resolveDocumentFileType } from '@/lib/documents/fileType'

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

  return NextResponse.json({
    ok: true,
    isPdf: fileType.isPdf,
    fileExtension: fileType.extension,
    url: fileType.isPdf ? `/api/documents/versions/${versionId}/file?disposition=inline&auditAction=PRINT` : undefined,
    downloadUrl: `/api/documents/versions/${versionId}/file?disposition=attachment&auditAction=PRINT`,
    document: {
      code: access.documentCode,
      title: access.documentTitle,
      revisionNumber: access.revisionNumber,
    },
  })
}