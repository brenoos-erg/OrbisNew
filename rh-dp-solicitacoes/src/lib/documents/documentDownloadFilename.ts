import path from 'node:path'

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
}

const SUPPORTED_EXTENSIONS = new Set(['pdf', 'docx', 'doc'])

function cleanExtension(value?: string | null): string | null {
  if (!value) return null
  const extension = path.extname(value.split('?')[0]?.split('#')[0] ?? '').toLowerCase().replace(/^\./, '')
  return SUPPORTED_EXTENSIONS.has(extension) ? extension : null
}

export function sanitizeDownloadFilename(value: string): string {
  const sanitized = String(value ?? '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return sanitized || 'documento'
}

export function getFileExtensionFromMimeOrPath(input: {
  mimeType?: string | null
  storedPath?: string | null
  originalFilename?: string | null
}): string {
  const mimeType = String(input.mimeType ?? '').split(';')[0]?.trim().toLowerCase()
  if (mimeType && MIME_EXTENSION_MAP[mimeType]) return MIME_EXTENSION_MAP[mimeType]

  return cleanExtension(input.originalFilename) ?? cleanExtension(input.storedPath) ?? 'pdf'
}

export function formatRevisionLabel(revisionNumber?: number | string | null): string {
  const raw = String(revisionNumber ?? '').trim()
  const parsed = raw === '' ? 0 : Number.parseInt(raw, 10)
  const revision = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  return `Rev.${String(revision).padStart(2, '0')}`
}

export function buildDocumentDownloadFilename(input: {
  code?: string | null
  title?: string | null
  revisionNumber?: number | string | null
  mimeType?: string | null
  storedPath?: string | null
  originalFilename?: string | null
}): string {
  const code = sanitizeDownloadFilename(input.code?.trim() ? input.code : 'DOCUMENTO')
  const title = sanitizeDownloadFilename(input.title?.trim() ? input.title : 'Documento')
  const revisionLabel = formatRevisionLabel(input.revisionNumber)
  const extension = getFileExtensionFromMimeOrPath(input)
  const basename = sanitizeDownloadFilename(`${code} - ${title} - ${revisionLabel}`)
  const maxBasenameLength = Math.max(1, 240 - extension.length - 1)
  const limitedBasename = basename.length > maxBasenameLength ? basename.slice(0, maxBasenameLength).trim() : basename

  return `${limitedBasename}.${extension}`
}

export function buildContentDispositionHeader(filename: string): string {
  const sanitized = sanitizeDownloadFilename(filename)
  const encoded = encodeURIComponent(sanitized)
  return `attachment; filename="${sanitized}"; filename*=UTF-8''${encoded}`
}
