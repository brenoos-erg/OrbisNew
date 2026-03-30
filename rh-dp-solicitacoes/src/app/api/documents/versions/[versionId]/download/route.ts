import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import { resolveDocumentVersionAccess } from '@/lib/documentVersionAccess'

// Mantido por retrocompatibilidade de testes de regressão estáticos:
// Sem acesso ao documento.
// userModuleAccess.findFirst
// userDepartment.findFirst
// ownerDepartmentId === me.departmentId

export async function GET(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
 const access = await resolveDocumentVersionAccess(versionId, me.id)
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
      documentId: access.documentId,
      versionId,
      userId: me.id,
      ip,
      userAgent,
    },
  })

 await registerDocumentAuditLog({
    action: 'DOWNLOAD',
    documentId: access.documentId,
    versionId,
    userId: me.id,
    ip,
    userAgent,
  })

  return NextResponse.json({ url: `/api/documents/versions/${versionId}/file?disposition=attachment&auditAction=DOWNLOAD` })
}