import fs from 'node:fs/promises'
import path from 'node:path'

import { applyUncontrolledCopyWatermark, hasUncontrolledCopyWatermark, validatePdfBuffer } from '@/lib/pdf/uncontrolledCopyWatermark'
import { isPdfBuffer, resolveDocumentFileType } from '@/lib/documents/fileType'
import { convertDocumentToPdf } from '@/lib/documents/wordToPdf'
import {
  buildStoredDocumentFileName,
  normalizeStoredDocumentUrl,
  resolvePublicDocumentPath,
} from '@/lib/documents/documentStorage'
import { resolveDocumentFamilyRule } from '@/lib/documents/documentFamilyRules'

type Input = {
  sourceFileUrl: string
  documentCode: string
}

export class DocumentPublishPipelineError extends Error {
  constructor(
    message: string,
    public readonly reason: 'RULE' | 'NOT_FOUND' | 'CONVERSION' | 'WATERMARK',
  ) {
    super(message)
    this.name = 'DocumentPublishPipelineError'
  }
}

export async function finalizeToPublishedPdf({ sourceFileUrl, documentCode }: Input): Promise<string> {
  const familyRule = resolveDocumentFamilyRule(documentCode)
  if (familyRule.family === 'non-controlled-native') {
    return sourceFileUrl
  }


const fileType = resolveDocumentFileType(sourceFileUrl)
  const pathResolution = await resolvePublicDocumentPath(sourceFileUrl)
  const normalizedSourceFileUrl = normalizeStoredDocumentUrl(pathResolution.resolvedFileUrl)

  console.info('[documents.finalize-published-pdf] source-path-resolution', {
    sourceFileUrl,
    resolvedFileUrl: pathResolution.resolvedFileUrl,
    absolutePath: pathResolution.absolutePath,
    exists: pathResolution.exists,
    attemptedAbsolutePaths: pathResolution.attemptedAbsolutePaths,
  })

  if (!pathResolution.exists) {
    throw new DocumentPublishPipelineError(
      `Arquivo físico da versão não encontrado: ${normalizedSourceFileUrl}`,
      'NOT_FOUND',
    )
  }

  const sourceAbsolutePath = pathResolution.absolutePath
  const sourceBuffer = await fs.readFile(sourceAbsolutePath)
  let pdfBuffer: Buffer

  if (fileType.isPdf && isPdfBuffer(sourceBuffer)) {
    pdfBuffer = Buffer.from(sourceBuffer)
  } else if (fileType.isConvertibleToPdf) {
    try {
      const converted = await convertDocumentToPdf({
        fileUrl: normalizedSourceFileUrl,
        sourceAbsolutePath,
      })
      pdfBuffer = converted.pdfBuffer
    } catch (error) {
      throw new DocumentPublishPipelineError(
        error instanceof Error ? error.message : 'Falha de conversão Word para PDF.',
        'CONVERSION',
      )
    }
  } else {
    throw new DocumentPublishPipelineError(
      `Formato ${fileType.extension || 'desconhecido'} não suportado para publicação em PDF.`,
      'RULE',
    )
  }

  const validation = validatePdfBuffer(pdfBuffer)
  if (!validation.valid) {
    throw new DocumentPublishPipelineError(`PDF inválido para publicação: ${validation.reason}`, 'CONVERSION')
  }

  const finalPdfBuffer = hasUncontrolledCopyWatermark(pdfBuffer)
    ? pdfBuffer
    : applyUncontrolledCopyWatermark(pdfBuffer)

  const outputValidation = validatePdfBuffer(finalPdfBuffer)
  if (!outputValidation.valid) {
    throw new DocumentPublishPipelineError(
      `PDF final inválido após marca d'água: ${outputValidation.reason}`,
      'WATERMARK',
    )
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents')
  await fs.mkdir(uploadDir, { recursive: true })

  const safeName = buildStoredDocumentFileName('.pdf', 'pdf')
  const outputAbsolutePath = path.join(uploadDir, safeName)
  await fs.writeFile(outputAbsolutePath, finalPdfBuffer)

  return `/uploads/documents/${safeName}`
}