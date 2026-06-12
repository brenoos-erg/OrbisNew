import type { DocumentNotificationEvent } from '@/lib/documents/documentNotificationTypes'

type PublicationVersion = {
  revisionNumber?: number | null
}

export function resolvePublicationNotificationEvent(version: PublicationVersion): DocumentNotificationEvent {
  return Number(version.revisionNumber ?? 0) > 0 ? 'DOCUMENT_REVISED' : 'DOCUMENT_PUBLISHED'
}

export function logDocumentNotificationFailure(event: DocumentNotificationEvent) {
  return (error: unknown) => console.error(`${event} notification failed`, error)
}
