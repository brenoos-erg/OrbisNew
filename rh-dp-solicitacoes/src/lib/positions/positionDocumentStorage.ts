import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { extractTextFromDocx, mapParsedDocumentToPositionPayload, parsePositionDescriptionText } from './positionDocumentParser'

export const POSITION_DOCUMENT_MAX_BYTES = Number(process.env.POSITION_DOCUMENT_MAX_BYTES ?? 20 * 1024 * 1024)
export const POSITION_DOCUMENT_ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'application/msword',
  '',
])

export type PositionDocumentPreview = {
  originalFilename: string
  storedFilename: string
  mimeType: string | null
  sizeBytes: number
  tempFileToken: string
  parsedText: string | null
  extracted: Record<string, any>
}

export function getSafePositionDocumentExtension(filename: string) {
  const ext = path.extname(filename).toLowerCase()
  return ['.docx', '.pdf', '.doc'].includes(ext) ? ext : ''
}

export function validatePositionDocumentFile(file: File) {
  const ext = getSafePositionDocumentExtension(file.name)
  if (!ext || (file.type && !POSITION_DOCUMENT_ALLOWED_MIME_TYPES.has(file.type))) {
    return 'Formato inválido. Envie .docx, .pdf ou .doc.'
  }
  if (file.size > POSITION_DOCUMENT_MAX_BYTES) return 'Arquivo excede o tamanho máximo permitido.'
  return null
}

export async function createPositionDocumentPreview(file: File): Promise<PositionDocumentPreview> {
  const validationError = validatePositionDocumentFile(file)
  if (validationError) throw new Error(validationError)

  const ext = getSafePositionDocumentExtension(file.name)
  const tempFileToken = `${Date.now()}-${randomUUID()}${ext}`
  const dir = path.join(process.cwd(), 'public', 'uploads', 'position-documents', 'tmp')
  await fs.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, tempFileToken)
  await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()))

  let parsedText: string | null = null
  let extracted: Record<string, any> = {}
  if (ext === '.docx') {
    parsedText = await extractTextFromDocx(filePath)
    extracted = mapParsedDocumentToPositionPayload(parsePositionDescriptionText(parsedText) as any)
  }

  return {
    originalFilename: file.name,
    storedFilename: tempFileToken,
    mimeType: file.type || null,
    sizeBytes: file.size,
    tempFileToken,
    parsedText,
    extracted,
  }
}

export async function attachPreviewedPositionDocument({
  prisma,
  positionId,
  uploadedById,
  tempFileToken,
  originalFilename,
  mimeType,
  sizeBytes,
  parsedText,
  extracted,
}: {
  prisma: PrismaClient | any
  positionId: string
  uploadedById: string
  tempFileToken: string
  originalFilename: string
  mimeType?: string | null
  sizeBytes?: number | null
  parsedText?: string | null
  extracted?: Record<string, any> | null
}) {
  const ext = getSafePositionDocumentExtension(tempFileToken)
  if (!ext) throw new Error('Token temporário inválido.')
  const sourcePath = path.join(process.cwd(), 'public', 'uploads', 'position-documents', 'tmp', path.basename(tempFileToken))
  await fs.access(sourcePath)

  const storedFilename = `${positionId}-${Date.now()}-${randomUUID()}${ext}`
  const finalDir = path.join(process.cwd(), 'public', 'uploads', 'position-documents')
  await fs.mkdir(finalDir, { recursive: true })
  await fs.rename(sourcePath, path.join(finalDir, storedFilename))

  const payload = extracted ?? {}
  return prisma.$transaction(async (tx: any) => {
    await tx.positionDocument.updateMany({ where: { positionId }, data: { isCurrent: false } })
    const document = await tx.positionDocument.create({
      data: {
        positionId,
        originalFilename,
        storedFilename,
        fileUrl: `/uploads/position-documents/${storedFilename}`,
        mimeType: mimeType ?? null,
        sizeBytes: sizeBytes ?? null,
        uploadedById,
        parsedText: parsedText ?? null,
        extractedJson: payload as any,
        indexador: payload.indexador ?? null,
        revision: payload.revision ?? null,
        documentDate: payload.documentDate ? new Date(payload.documentDate) : null,
        isCurrent: true,
      },
    })
    await tx.position.update({ where: { id: positionId }, data: { latestDocumentId: document.id } })
    return document
  })
}
