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

type Input = {
  sourceFileUrl: string
}


export async function finalizeToPublishedPdf({ sourceFileUrl }: Input): Promise<string> {
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
    throw new Error(`Arquivo físico da versão não encontrado: ${normalizedSourceFileUrl}`)
  }

  const sourceAbsolutePath = pathResolution.absolutePath
  const sourceBuffer = await fs.readFile(sourceAbsolutePath)
  let pdfBuffer: Buffer

  if (fileType.isPdf && isPdfBuffer(sourceBuffer)) {
    pdfBuffer = Buffer.from(sourceBuffer)
  } else if (fileType.isConvertibleToPdf) {
    const converted = await convertDocumentToPdf({
      fileUrl: normalizedSourceFileUrl,
      sourceAbsolutePath,
    })
    pdfBuffer = converted.pdfBuffer
  } else {
    throw new Error(`Formato ${fileType.extension || 'desconhecido'} não suportado para publicação em PDF.`)
  }

  const validation = validatePdfBuffer(pdfBuffer)
  if (!validation.valid) {
    throw new Error(`PDF inválido para publicação: ${validation.reason}`)
  }

  const finalPdfBuffer = hasUncontrolledCopyWatermark(pdfBuffer)
    ? pdfBuffer
    : applyUncontrolledCopyWatermark(pdfBuffer)

  const outputValidation = validatePdfBuffer(finalPdfBuffer)
  if (!outputValidation.valid) {
    throw new Error(`PDF final inválido após marca d'água: ${outputValidation.reason}`)
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents')
  await fs.mkdir(uploadDir, { recursive: true })

  const safeName = buildStoredDocumentFileName('.pdf', 'pdf')
  const outputAbsolutePath = path.join(uploadDir, safeName)
  await fs.writeFile(outputAbsolutePath, finalPdfBuffer)

  return `/uploads/documents/${safeName}`
}