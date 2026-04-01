import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { DocumentAccessIntent, DocumentTermChallenge } from '@/lib/documentVersionAccess'
import { resolveDocumentVersionAccess } from '@/lib/documentVersionAccess'
import { convertDocumentToPdf } from '@/lib/documents/wordToPdf'
import { DOCUMENT_PDF_MIME, isPdfBuffer, resolveDocumentFileType } from '@/lib/documents/fileType'
import { applyUncontrolledCopyWatermark, hasUncontrolledCopyWatermark, validatePdfBuffer } from '@/lib/pdf/uncontrolledCopyWatermark'

export type FinalPdfError = { error: string; status: 401 | 403 | 404 }
export type FinalPdfTermChallenge = { termChallenge: DocumentTermChallenge; status: 403 }

type DocumentAccessResolved = {
  versionId: string
  documentId: string
  fileUrl: string
  revisionNumber: number
  documentCode: string
  documentTitle: string
}

export type ResolveDocumentFinalPdfResult = {
  outputBuffer: Buffer
  outputFileName: string
  mimeType: typeof DOCUMENT_PDF_MIME
  sourceExtension: string
  watermarkApplied: boolean
  access: DocumentAccessResolved
}

function normalizeStoredUrl(url: string) {
  return url.startsWith('/') ? url : `/${url}`
}

function toPublicAbsolutePath(fileUrl: string) {
  const normalized = normalizeStoredUrl(fileUrl)
  const relativeToPublic = normalized.replace(/^\/+/, '')
  return path.join(process.cwd(), 'public', relativeToPublic)
}

export async function resolveDocumentFinalPdf(
  versionId: string,
  userId: string,
  intent: DocumentAccessIntent,
): Promise<ResolveDocumentFinalPdfResult | FinalPdfError | FinalPdfTermChallenge> {
  const access = await resolveDocumentVersionAccess(versionId, userId, intent)
  if ('error' in access) return { error: access.error, status: access.status } as FinalPdfError
  if ('termChallenge' in access) return { termChallenge: access.termChallenge, status: access.status } as FinalPdfTermChallenge

  const normalizedFileUrl = normalizeStoredUrl(access.fileUrl)
  const absolutePath = toPublicAbsolutePath(access.fileUrl)
  const fileBuffer = await readFile(absolutePath)
  const originalFileName = path.basename(normalizedFileUrl)
  const fileType = resolveDocumentFileType(access.fileUrl)

  let pdfSource: Buffer | null = null
  let outputFileName = originalFileName

  if (fileType.isPdf && isPdfBuffer(fileBuffer)) {
    pdfSource = Buffer.from(fileBuffer)
  } else if (fileType.isConvertibleToPdf) {
    const converted = await convertDocumentToPdf({ fileUrl: access.fileUrl, sourceAbsolutePath: absolutePath })
    pdfSource = converted.pdfBuffer
    outputFileName = converted.outputFileName
  }

  if (!pdfSource) {
    throw new Error(`Formato ${fileType.extension || 'desconhecido'} não suportado para saída final em PDF.`)
  }

  const sourceValidation = validatePdfBuffer(pdfSource)
  if (!sourceValidation.valid) {
    throw new Error(`O PDF intermediário está inválido: ${sourceValidation.reason}`)
  }

  let outputBuffer: Buffer = Buffer.from(pdfSource)
  let watermarkApplied = hasUncontrolledCopyWatermark(pdfSource)
  if (!watermarkApplied) {
    outputBuffer = applyUncontrolledCopyWatermark(pdfSource)
    watermarkApplied = true
  }

  const outputValidation = validatePdfBuffer(outputBuffer)
  if (!outputValidation.valid) {
    throw new Error(`O PDF final com marca d'água ficou inválido: ${outputValidation.reason}`)
  }

  return {
    outputBuffer,
    outputFileName,
    mimeType: DOCUMENT_PDF_MIME,
    sourceExtension: fileType.extension,
    watermarkApplied,
    access,
  }
}