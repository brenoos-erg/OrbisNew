import type { NextRequest } from 'next/server'
import { ModuleLevel, PrintCopyType } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import { buildControlledPdf } from '@/lib/documents/controlledPdfPipeline'

export type ControlledIntent = 'view' | 'download' | 'print'

type ControlledActionSuccess = {
  ok: true
  intent: ControlledIntent
  isPdf: boolean
  fileExtension: string
  url: string
  downloadUrl: string
  printUrl: string
  controlledFlowApplied: boolean
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
    type: PrintCopyType
    validUntil?: Date | null
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
        type: data.type,
        issuedById: data.userId,
        copyNumber: `CP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        validUntil: data.validUntil ?? null,
        watermark: data.type === PrintCopyType.CONTROLLED ? 'CÓPIA CONTROLADA' : 'CÓPIA NÃO CONTROLADA',
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
  const requestedCopyType = input.req.nextUrl.searchParams.get('copyType') === 'CONTROLLED'
    ? PrintCopyType.CONTROLLED
    : PrintCopyType.UNCONTROLLED

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
    if (requestedCopyType === PrintCopyType.CONTROLLED && resolved.access.moduleLevel !== ModuleLevel.NIVEL_3) {
      return { error: 'Somente usuários NIVEL_3 podem emitir cópia controlada.', status: 403 }
    }
    await deps.createPrintCopy({
      documentId: resolved.access.documentId,
      versionId: resolved.access.versionId,
      userId: input.userId,
      type: requestedCopyType,
      validUntil: resolved.access.expiresAt ?? null,
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
    isPdf: resolved.isPdf,
    fileExtension: resolved.sourceExtension,
    url: `/api/documents/versions/${input.versionId}/file?disposition=inline&auditAction=${intentUpper}`,
    downloadUrl: `/api/documents/versions/${input.versionId}/file?disposition=attachment&auditAction=${intentUpper}`,
    printUrl: `/documentos/impressao/${input.versionId}`,
    controlledFlowApplied: resolved.controlledFlowApplied,
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