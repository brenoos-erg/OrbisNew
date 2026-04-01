import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import { prisma } from '@/lib/prisma'
import { resolveDocumentVersionAccess } from '@/lib/documentVersionAccess'

export async function GET(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: true },
  })

  if (!version || version.status !== DocumentVersionStatus.PUBLICADO) {
    return NextResponse.json({ error: 'Documento publicado não encontrado.' }, { status: 404 })
  }

  const access = await resolveDocumentVersionAccess(versionId, me.id, 'download')
  if ('error' in access) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }
  if ('termChallenge' in access) {
    return NextResponse.json(access.termChallenge, { status: access.status })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = req.headers.get('user-agent')

  await prisma.documentDownloadLog.create({
    data: {
      documentId: version.documentId,
      versionId: access.versionId,
      userId: me.id,
      ip,
      userAgent,
    },
  })

  await registerDocumentAuditLog({
    action: 'DOWNLOAD',
    documentId: access.documentId,
    versionId: access.versionId,
    userId: me.id,
    ip,
    userAgent,
  })

  return NextResponse.json({ url: `/api/documents/versions/${versionId}/file?disposition=attachment&auditAction=DOWNLOAD` })
}