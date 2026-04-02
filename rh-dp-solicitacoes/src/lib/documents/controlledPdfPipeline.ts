import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { DocumentAccessIntent, DocumentTermChallenge } from '@/lib/documentVersionAccess'
import { resolveDocumentVersionAccess } from '@/lib/documentVersionAccess'
import { convertDocumentToPdf } from '@/lib/documents/wordToPdf'
import { normalizeStoredDocumentUrl, resolvePublicDocumentPath } from '@/lib/documents/documentStorage'
import { DOCUMENT_PDF_MIME, isPdfBuffer, resolveDocumentFileType } from '@/lib/documents/fileType'
import { resolveDocumentFamilyRule } from '@/lib/documents/documentFamilyRules'
import { applyDocumentHeaderStamp } from '@/lib/pdf/documentHeaderStamp'
import {
  applyUncontrolledCopyWatermark,
  hasUncontrolledCopyWatermark,
  validatePdfBuffer,
} from '@/lib/pdf/uncontrolledCopyWatermark'

export type ControlledPdfError = { error: string; status: 401 | 403 | 404 }
export type ControlledPdfTermChallenge = { termChallenge: DocumentTermChallenge; status: 403 }

type DocumentAccessResolved = {
  versionId: string
  documentId: string
  fileUrl: string
  revisionNumber: number
  documentCode: string
  documentTitle: string
  publicationDate?: Date | null
  elaboratorName?: string | null
  approverName?: string | null
}


export type BuildControlledPdfResult = {
  outputBuffer: Buffer
  outputFileName: string
  mimeType: string
  sourceExtension: string
  watermarkApplied: boolean
  convertedToPdf: boolean
  headerApplied: boolean
  controlledFlowApplied: boolean
  isPdf: boolean
  access: DocumentAccessResolved
}

type BuildControlledPdfDeps = {
  resolveAccess: typeof resolveDocumentVersionAccess
  readSourceFile: (absolutePath: string) => Promise<Buffer>
  convertToPdf: typeof convertDocumentToPdf
  detectFileType: typeof resolveDocumentFileType
  detectPdfBuffer: typeof isPdfBuffer
  validatePdf: typeof validatePdfBuffer
  hasWatermark: typeof hasUncontrolledCopyWatermark
  applyWatermark: typeof applyUncontrolledCopyWatermark
  applyHeader: typeof applyDocumentHeaderStamp
}
const defaultDeps: BuildControlledPdfDeps = {
  resolveAccess: resolveDocumentVersionAccess,
  readSourceFile: readFile,
  convertToPdf: convertDocumentToPdf,
  detectFileType: resolveDocumentFileType,
  detectPdfBuffer: isPdfBuffer,
  validatePdf: validatePdfBuffer,
  hasWatermark: hasUncontrolledCopyWatermark,
  applyWatermark: applyUncontrolledCopyWatermark,
  applyHeader: applyDocumentHeaderStamp,
}

function formatPublicationDate(value?: Date | null): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(value)
}

function buildHeaderLine(access: DocumentAccessResolved): string {
  return `Código: ${access.documentCode} | Nº Revisão: ${access.revisionNumber} | Data Publicação: ${formatPublicationDate(access.publicationDate)} | Elaborador: ${access.elaboratorName ?? '-'} | Aprovador: ${access.approverName ?? '-'}`
}

export async function buildControlledPdfWithDeps(
  versionId: string,
  userId: string,
  intent: DocumentAccessIntent,
  deps: BuildControlledPdfDeps,
): Promise<BuildControlledPdfResult | ControlledPdfError | ControlledPdfTermChallenge> {
  const access = await deps.resolveAccess(versionId, userId, intent)
  if ('error' in access) {
    return {
      error: access.error as string,
      status: access.status as 401 | 403 | 404,
    }
  }

  if ('termChallenge' in access) {
    return {
      termChallenge: access.termChallenge as DocumentTermChallenge,
      status: access.status as 403,
    }
  }

  const pathResolution = await resolvePublicDocumentPath(access.fileUrl)
  const normalizedFileUrl = normalizeStoredDocumentUrl(pathResolution.resolvedFileUrl)

  console.info('[documents.controlled-pdf] source-path-resolution', {
    versionId,
    intent,
    fileUrl: access.fileUrl,
    resolvedFileUrl: pathResolution.resolvedFileUrl,
    absolutePath: pathResolution.absolutePath,
    exists: pathResolution.exists,
    attemptedAbsolutePaths: pathResolution.attemptedAbsolutePaths,
  })

  if (!pathResolution.exists) {
    const error = new Error(`Arquivo físico do documento não encontrado para ${normalizedFileUrl}`)
    ;(error as NodeJS.ErrnoException).code = 'ENOENT'
    throw error
  }

  const absolutePath = pathResolution.absolutePath
  const sourceBuffer = await deps.readSourceFile(absolutePath)
  const originalFileName = path.basename(normalizedFileUrl)
  const sourceType = deps.detectFileType(access.fileUrl)
  const bufferLooksLikePdf = deps.detectPdfBuffer(sourceBuffer)
  const familyRule = resolveDocumentFamilyRule(access.documentCode)

  console.info('[documents.controlled-pdf] source-loaded', {
    versionId,
    intent,
    documentId: access.documentId,
    fileUrl: normalizedFileUrl,
    extension: sourceType.extension,
    mimeType: sourceType.mimeType,
    isPdfByExtension: sourceType.isPdf,
    isPdfByBuffer: bufferLooksLikePdf,
    isConvertibleToPdf: sourceType.isConvertibleToPdf,
    family: familyRule.family,
  })

  if (familyRule.family === 'non-controlled-native') {
    return {
      outputBuffer: sourceBuffer,
      outputFileName: originalFileName,
      mimeType: sourceType.mimeType || 'application/octet-stream',
      sourceExtension: sourceType.extension,
      watermarkApplied: false,
      convertedToPdf: false,
      headerApplied: false,
      controlledFlowApplied: false,
      isPdf: bufferLooksLikePdf,
      access,
    }
  }

  let pdfSourceBuffer: Buffer | null = null
  let outputFileName = originalFileName
  let convertedToPdf = false

  if (bufferLooksLikePdf) {
    pdfSourceBuffer = Buffer.from(sourceBuffer)
    console.info('[documents.controlled-pdf] pdf-source-detected', {
      versionId,
      intent,
      detectedBy: sourceType.isPdf ? 'extension+header' : 'header-only',
    })
  } else if (sourceType.isConvertibleToPdf) {
    console.info('[documents.controlled-pdf] conversion-start', {
      versionId,
      intent,
      sourceExtension: sourceType.extension,
    })

    const converted = await deps.convertToPdf({
      fileUrl: access.fileUrl,
      sourceAbsolutePath: absolutePath,
    })

    pdfSourceBuffer = converted.pdfBuffer
    outputFileName = converted.outputFileName
    convertedToPdf = true

    console.info('[documents.controlled-pdf] conversion-finished', {
      versionId,
      intent,
      sourceExtension: sourceType.extension,
      outputFileName,
      size: converted.pdfBuffer.length,
    })
  }

  if (!pdfSourceBuffer) {
    console.error('[documents.controlled-pdf] unsupported-source', {
      versionId,
      intent,
      extension: sourceType.extension,
      mimeType: sourceType.mimeType,
    })
    throw new Error(`Formato ${sourceType.extension || 'desconhecido'} não suportado para saída final em PDF.`)
  }

  const convertedValidation = deps.validatePdf(pdfSourceBuffer)
  if (!convertedValidation.valid) {
    console.error('[documents.controlled-pdf] intermediate-pdf-invalid', {
      versionId,
      intent,
      reason: convertedValidation.reason,
    })
    throw new Error(`O PDF intermediário está inválido: ${convertedValidation.reason}`)
  }

  let finalPdfBuffer: Buffer = Buffer.from(pdfSourceBuffer)
  let watermarkApplied = deps.hasWatermark(pdfSourceBuffer)
  const headerLine = buildHeaderLine(access)

  if (!watermarkApplied) {
    finalPdfBuffer = deps.applyWatermark(pdfSourceBuffer)
    watermarkApplied = true
  }

  finalPdfBuffer = deps.applyHeader(finalPdfBuffer, headerLine)

  console.info('[documents.controlled-pdf] watermark-step-complete', {
    versionId,
    intent,
    watermarkApplied,
  })

  const finalValidation = deps.validatePdf(finalPdfBuffer)
  if (!finalValidation.valid) {
    console.error('[documents.controlled-pdf] final-pdf-invalid', {
      versionId,
      intent,
      reason: finalValidation.reason,
    })
    throw new Error(`O PDF final com marca d'água ficou inválido: ${finalValidation.reason}`)
  }

  console.info('[documents.controlled-pdf] final-pdf-validated', {
    versionId,
    intent,
    convertedToPdf,
    size: finalPdfBuffer.length,
  })

 return {
    outputBuffer: finalPdfBuffer,
    outputFileName,
    mimeType: DOCUMENT_PDF_MIME,
    sourceExtension: sourceType.extension,
    watermarkApplied,
    convertedToPdf,
    headerApplied: true,
    controlledFlowApplied: true,
    isPdf: true,
    access,
  }
}

export function buildControlledPdf(versionId: string, userId: string, intent: DocumentAccessIntent) {
  return buildControlledPdfWithDeps(versionId, userId, intent, defaultDeps)
}
