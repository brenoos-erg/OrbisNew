import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DocumentPublicationError, publishDocumentVersion } from '@/lib/documents/publishDocumentVersion'
import { sendDocumentNotification } from '@/lib/documents/documentNotificationService'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const body = await req.json().catch(() => null) ?? {}
  const justification = String(body.justification ?? '').trim()
  const segregationExceptionId = typeof body.segregationExceptionId === 'string' ? body.segregationExceptionId : null
  if (justification.length < 10) return NextResponse.json({ error: 'Publicação direta exige justificativa com no mínimo 10 caracteres.' }, { status: 400 })
  try {
    const result = await publishDocumentVersion({ versionId, actorUserId: me.id, justification, directPublication: true, segregationExceptionId })
    if (result.notified) {
      const version = await prisma.documentVersion.findUnique({ where: { id: versionId }, select: { documentId: true } })
      if (version) void sendDocumentNotification('DOCUMENT_PUBLISHED', { documentId: version.documentId, versionId, actorUserId: me.id }).catch((error) => console.error('DOCUMENT_PUBLISHED notification failed', error))
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof DocumentPublicationError) return NextResponse.json({ error: error.message, ...error.details }, { status: error.status })
    return NextResponse.json({ error: 'Falha ao retomar publicação direta.' }, { status: 500 })
  }
}
