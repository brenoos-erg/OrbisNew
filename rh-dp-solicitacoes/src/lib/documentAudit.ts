import { prisma } from '@/lib/prisma'

export type DocumentAuditAction = 'VIEW' | 'DOWNLOAD' | 'SOURCE_FILE_VIEWED' | 'SOURCE_FILE_DOWNLOADED' | 'SOURCE_FILE_INTEGRITY_FAILED' | 'PUBLISHED_FILE_INTEGRITY_FAILED' | 'PRINT'

export async function registerDocumentAuditLog(input: {
  action: DocumentAuditAction
  documentId: string
  versionId: string
  userId: string
  ip?: string | null
  userAgent?: string | null
}) {
  return prisma.documentAuditLog.create({
    data: {
      action: input.action,
      documentId: input.documentId,
      versionId: input.versionId,
      userId: input.userId,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  })
}
