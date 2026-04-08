import { access } from 'node:fs/promises'
import path from 'node:path'

const PUBLIC_DIR = path.join(process.cwd(), 'public')
const DOCUMENTS_DIR = path.join(PUBLIC_DIR, 'uploads', 'documents')

function toPosix(input: string) {
  return input.replace(/\\+/g, '/').trim()
}

export function buildDocumentUploadPaths(fileName: string) {
  const sanitizedFileName = fileName.replace(/[\r\n/\\]+/g, '_')
  const relativeUrl = `/uploads/documents/${sanitizedFileName}`
  const absolutePath = path.join(DOCUMENTS_DIR, sanitizedFileName)
  return { relativeUrl, absolutePath }
}

export function normalizeStoredAttachmentUrl(rawUrl: string | null | undefined) {
  const raw = toPosix(String(rawUrl || ''))
  if (!raw) return null

  const withoutHash = raw.split('#')[0]?.split('?')[0] || ''
  const withoutLeading = withoutHash.replace(/^\/+/, '')
  const withoutPublicPrefix = withoutLeading.replace(/^public\//i, '')

  if (!withoutPublicPrefix) return null
  return `/${withoutPublicPrefix}`
}

export function toPublicAbsolutePath(urlPath: string) {
  const normalized = normalizeStoredAttachmentUrl(urlPath)
  if (!normalized) return null

  const relNoSlash = normalized.replace(/^\/+/, '')
  const absolutePath = path.join(PUBLIC_DIR, relNoSlash)
  const relativeFromPublic = path.relative(PUBLIC_DIR, absolutePath)
  if (relativeFromPublic.startsWith('..') || path.isAbsolute(relativeFromPublic)) return null

  return absolutePath
}

export async function resolveExistingAttachmentPath(urlPath: string | null | undefined) {
  const normalized = normalizeStoredAttachmentUrl(urlPath)
  if (!normalized) return null

  const primary = toPublicAbsolutePath(normalized)
  if (primary) {
    try {
      await access(primary)
      return { normalizedUrl: normalized, absolutePath: primary }
    } catch {
      // fallback handled below
    }
  }

  const baseName = path.posix.basename(normalized)
  if (!baseName) return null

  const fallbackAbsolutePath = path.join(DOCUMENTS_DIR, baseName)
  try {
    await access(fallbackAbsolutePath)
    return {
      normalizedUrl: `/uploads/documents/${baseName}`,
      absolutePath: fallbackAbsolutePath,
    }
  } catch {
    return null
  }
}

export function getInlineMimeType(mimeType?: string | null, filename?: string | null) {
  const cleanMime = String(mimeType || '').trim().toLowerCase()
  if (cleanMime) return cleanMime

  const ext = path.extname(String(filename || '')).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.svg') return 'image/svg+xml'
  return 'application/octet-stream'
}