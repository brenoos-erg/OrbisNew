import path from 'node:path'

const PDF_MIME = 'application/pdf'

const EXTENSION_MIME_MAP: Record<string, string> = {
  '.pdf': PDF_MIME,
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain; charset=utf-8',
}

export type DocumentFileType = {
  extension: string
  mimeType: string
  isPdf: boolean
  isWord: boolean
}

export function resolveDocumentFileType(fileUrl: string): DocumentFileType {
  const extension = path.extname(fileUrl).toLowerCase()
  const mimeType = EXTENSION_MIME_MAP[extension] ?? 'application/octet-stream'

  return {
    extension,
    mimeType,
    isPdf: extension === '.pdf',
    isWord: extension === '.doc' || extension === '.docx',
  }
}

export function isPdfBuffer(buffer: Buffer): boolean {
  if (!buffer?.length) return false
  const header = buffer.subarray(0, Math.min(1024, buffer.length)).toString('latin1')
  return header.includes('%PDF-')
}

export const DOCUMENT_PDF_MIME = PDF_MIME
