import fs from 'node:fs/promises'
import path from 'node:path'

import { randomUUID } from 'node:crypto'
import { applyUncontrolledCopyWatermark, hasUncontrolledCopyWatermark, validatePdfBuffer } from '@/lib/pdf/uncontrolledCopyWatermark'
import { isPdfBuffer, resolveDocumentFileType } from '@/lib/documents/fileType'
import { convertDocumentToPdf } from '@/lib/documents/wordToPdf'

type Input = {
  sourceFileUrl: string
}

function normalizeStoredUrl(url: string) {
  return url.startsWith('/') ? url : `/${url}`
}

function toPublicAbsolutePath(fileUrl: string) {
  const normalized = normalizeStoredUrl(fileUrl)
  const relativeToPublic = normalized.replace(/^\/+/, '')
  return path.join(process.cwd(), 'public', relativeToPublic)
}

export async function finalizeToPublishedPdf({ sourceFileUrl }: Input): Promise<string> {
  const fileType = resolveDocumentFileType(sourceFileUrl)
  const sourceAbsolutePath = toPublicAbsolutePath(sourceFileUrl)

  const sourceBuffer = await fs.readFile(sourceAbsolutePath)
  let pdfBuffer: Buffer

  if (fileType.isPdf && isPdfBuffer(sourceBuffer)) {
    pdfBuffer = Buffer.from(sourceBuffer)
  } else if (fileType.isConvertibleToPdf) {
    const converted = await convertDocumentToPdf({
      fileUrl: sourceFileUrl,
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

  const baseName = path.basename(sourceAbsolutePath, path.extname(sourceAbsolutePath)).replace(/\s+/g, '-')
  const safeName = `${Date.now()}-${randomUUID()}-${baseName}.pdf`
  const outputAbsolutePath = path.join(uploadDir, safeName)
  await fs.writeFile(outputAbsolutePath, finalPdfBuffer)

  return `/uploads/documents/${safeName}`
}