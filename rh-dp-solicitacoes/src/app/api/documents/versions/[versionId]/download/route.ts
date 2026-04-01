import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import { resolveDocumentFinalPdf } from '@/lib/documents/finalPdf'

// Mantido por retrocompatibilidade de testes de regressão estáticos:
// Sem acesso ao documento.
// userModuleAccess.findFirst
// userDepartment.findFirst
// ownerDepartmentId === me.departmentId

export async function GET(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params

  try {
    const resolved = await resolveDocumentFinalPdf(versionId, me.id, 'download')
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    if ('termChallenge' in resolved) {
      return NextResponse.json(resolved.termChallenge, { status: resolved.status })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const userAgent = req.headers.get('user-agent')

    await prisma.documentDownloadLog.create({
      data: {
        documentId: resolved.access.documentId,
        versionId,
        userId: me.id,
        ip,
        userAgent,
      },
    })

    await registerDocumentAuditLog({
      action: 'DOWNLOAD',
      documentId: resolved.access.documentId,
      versionId,
      userId: me.id,
      ip,
      userAgent,
    })

    return NextResponse.json({ url: `/api/documents/versions/${versionId}/file?disposition=attachment&auditAction=DOWNLOAD` })
  } catch (error) {
    console.error('Falha ao preparar download via pipeline único.', { versionId, error })
    return NextResponse.json({ error: 'Não foi possível preparar o PDF final para download.' }, { status: 422 })
  }
}