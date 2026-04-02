import type { NextRequest } from 'next/server'
import { PrintCopyType } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import { resolveDocumentFinalPdf } from '@/lib/documents/finalPdf'

export type ControlledIntent = 'view' | 'download' | 'print'

type ControlledActionSuccess = {
  ok: true
  intent: ControlledIntent
  isPdf: true
  fileExtension: string
  url: string
  downloadUrl: string
  printUrl: string
  document: {
    code: string
    title: string
    revisionNumber: number
  }
}

type ControlledActionFailure =
  | { error: string; status: 401 | 403 | 404 | 422 }
  | { termChallenge: unknown; status: 403 }

export async function executeControlledDocumentAction(input: {
  req: NextRequest
  versionId: string
  userId: string
  intent: ControlledIntent
}): Promise<ControlledActionSuccess | ControlledActionFailure> {
  const resolved = await resolveDocumentFinalPdf(input.versionId, input.userId, input.intent)
  if ('error' in resolved) return { error: resolved.error, status: resolved.status }
  if ('termChallenge' in resolved) return { termChallenge: resolved.termChallenge, status: resolved.status }

  const ip = input.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = input.req.headers.get('user-agent')
  const intentUpper = input.intent.toUpperCase() as 'VIEW' | 'DOWNLOAD' | 'PRINT'

  if (input.intent === 'download') {
    await prisma.documentDownloadLog.create({
      data: {
        documentId: resolved.access.documentId,
        versionId: resolved.access.versionId,
        userId: input.userId,
        ip,
        userAgent,
      },
    })
  }

  if (input.intent === 'print') {
    await prisma.printCopy.create({
      data: {
        documentId: resolved.access.documentId,
        versionId: resolved.access.versionId,
        type: PrintCopyType.UNCONTROLLED,
        issuedById: input.userId,
      },
    })
  }

  await registerDocumentAuditLog({
    action: intentUpper,
    documentId: resolved.access.documentId,
    versionId: resolved.access.versionId,
    userId: input.userId,
    ip,
    userAgent,
  })

  console.info('[documents.controlled-action] completed', {
    versionId: resolved.access.versionId,
    documentId: resolved.access.documentId,
    userId: input.userId,
    intent: input.intent,
    sourceExtension: resolved.sourceExtension,
    watermarkApplied: resolved.watermarkApplied,
  })

  return {
    ok: true,
    intent: input.intent,
    isPdf: true,
    fileExtension: resolved.sourceExtension,
    url: `/api/documents/versions/${input.versionId}/file?disposition=inline&auditAction=${intentUpper}`,
    downloadUrl: `/api/documents/versions/${input.versionId}/file?disposition=attachment&auditAction=${intentUpper}`,
    printUrl: `/documentos/impressao/${input.versionId}`,
    document: {
      code: resolved.access.documentCode,
      title: resolved.access.documentTitle,
      revisionNumber: resolved.access.revisionNumber,
    },
  }
}