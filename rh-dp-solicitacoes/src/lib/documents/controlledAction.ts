import type { NextRequest } from 'next/server'
import { PrintCopyType } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import { buildControlledPdf } from '@/lib/documents/controlledPdfPipeline'

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

type ControlledActionDeps = {
  buildControlledPdf: typeof buildControlledPdf
  createDownloadLog: (data: {
    documentId: string
    versionId: string
    userId: string
    ip: string | null
    userAgent: string | null
  }) => Promise<unknown>
  createPrintCopy: (data: {
    documentId: string
    versionId: string
    userId: string
  }) => Promise<unknown>
  registerAuditLog: typeof registerDocumentAuditLog
}

const defaultDeps: ControlledActionDeps = {
  buildControlledPdf,
  createDownloadLog: (data) =>
    prisma.documentDownloadLog.create({
      data: {
        documentId: data.documentId,
        versionId: data.versionId,
        userId: data.userId,
        ip: data.ip,
        userAgent: data.userAgent,
      },
    }),
  createPrintCopy: (data) =>
    prisma.printCopy.create({
      data: {
        documentId: data.documentId,
        versionId: data.versionId,
        type: PrintCopyType.UNCONTROLLED,
        issuedById: data.userId,
      },
    }),
  registerAuditLog: registerDocumentAuditLog,
}

async function executeControlledDocumentActionWithDeps(
  input: {
    req: NextRequest
    versionId: string
    userId: string
    intent: ControlledIntent
  },
  deps: ControlledActionDeps,
): Promise<ControlledActionSuccess | ControlledActionFailure> {
  const resolved = await deps.buildControlledPdf(input.versionId, input.userId, input.intent)
  if ('error' in resolved) return { error: resolved.error, status: resolved.status }
  if ('termChallenge' in resolved) return { termChallenge: resolved.termChallenge, status: resolved.status }

  const ip = input.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = input.req.headers.get('user-agent')
  const intentUpper = input.intent.toUpperCase() as 'VIEW' | 'DOWNLOAD' | 'PRINT'

  if (input.intent === 'download') {
    await deps.createDownloadLog({
      documentId: resolved.access.documentId,
      versionId: resolved.access.versionId,
      userId: input.userId,
      ip,
      userAgent,
    })
  }

  if (input.intent === 'print') {
    await deps.createPrintCopy({
      documentId: resolved.access.documentId,
      versionId: resolved.access.versionId,
      userId: input.userId,
    })
  }

  await deps.registerAuditLog({
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
    convertedToPdf: resolved.convertedToPdf,
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

export function executeControlledDocumentAction(input: {
  req: NextRequest
  versionId: string
  userId: string
  intent: ControlledIntent
}) {
  return executeControlledDocumentActionWithDeps(input, defaultDeps)
}

export { executeControlledDocumentActionWithDeps }