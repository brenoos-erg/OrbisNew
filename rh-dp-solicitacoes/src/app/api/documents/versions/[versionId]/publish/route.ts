import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { getDocumentContextByVersionId } from '@/lib/documents/documentRoleAccess'
import { sendDocumentNotification } from '@/lib/documents/documentNotificationService'
import { logDocumentNotificationFailure, resolvePublicationNotificationEvent } from '@/lib/documents/documentPublicationNotification'
import { DocumentPublicationError, publishDocumentVersion } from '@/lib/documents/publishDocumentVersion'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const body = await req.json().catch(() => null) ?? {}
  const justification = String(body.justification ?? '').trim()
  const segregationExceptionId = body.segregationExceptionId ? String(body.segregationExceptionId) : null

  try {
    const result = await publishDocumentVersion({ versionId, actorUserId: me.id, justification, segregationExceptionId })
    const version = await prisma.documentVersion.findUnique({ where: { id: versionId }, include: { document: true } })
    if (version && result.notified) {
      const publicationEvent = resolvePublicationNotificationEvent(version)
      void sendDocumentNotification(publicationEvent, { documentId: version.documentId, versionId, actorUserId: me.id }).catch(logDocumentNotificationFailure(publicationEvent))
    }
    return NextResponse.json({ ...result, publishedFileAvailable: Boolean(result.publishedFileUrl), context: await getDocumentContextByVersionId(versionId) })
  } catch (error) {
    if (error instanceof DocumentPublicationError) return NextResponse.json({ error: error.message, ...(error.details ?? {}) }, { status: error.status })
    return NextResponse.json({ error: 'Não foi possível publicar a versão.' }, { status: 500 })
  }
}
