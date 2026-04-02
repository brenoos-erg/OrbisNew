import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export function normalizeStoredDocumentUrl(url: string) {
  const slashNormalized = String(url ?? '').replace(/\\/g, '/').trim()
  if (!slashNormalized) return '/'
  return slashNormalized.startsWith('/') ? slashNormalized : `/${slashNormalized}`
}

function toAbsoluteFromPublicUrl(fileUrl: string) {
  const normalized = normalizeStoredDocumentUrl(fileUrl)
  const relativeToPublic = normalized.replace(/^\/+/, '')
  return path.join(process.cwd(), 'public', ...relativeToPublic.split('/'))
}

export async function resolvePublicDocumentPath(fileUrl: string) {
  const normalized = normalizeStoredDocumentUrl(fileUrl)

  const decodedCandidate = (() => {
    try {
      const decoded = decodeURIComponent(normalized)
      return decoded === normalized ? null : decoded
    } catch {
      return null
    }
  })()

  const urlCandidates = [normalized, decodedCandidate].filter((value): value is string => Boolean(value))
  const attemptedAbsolutePaths: string[] = []

  for (const candidate of urlCandidates) {
    const absolutePath = toAbsoluteFromPublicUrl(candidate)
    attemptedAbsolutePaths.push(absolutePath)

    try {
      await fs.access(absolutePath, fs.constants.R_OK)
      return {
        exists: true as const,
        resolvedFileUrl: candidate,
        absolutePath,
        attemptedAbsolutePaths,
      }
    } catch {
      continue
    }
  }

  return {
    exists: false as const,
    resolvedFileUrl: normalized,
    absolutePath: toAbsoluteFromPublicUrl(normalized),
    attemptedAbsolutePaths,
  }
}

function sanitizeFileStem(stem: string, maxLength = 40) {
  const normalized = stem
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/_+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')

  const safe = normalized || 'documento'
  return safe.slice(0, maxLength)
}

function stripGeneratedPrefixes(stem: string) {
  let result = stem

  for (let i = 0; i < 10; i += 1) {
    const next = result
      .replace(/^\d{10,16}-/, '')
      .replace(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}-/i, '')
      .replace(/^[a-z]{2,5}-[a-z0-9]{4,12}-[a-f0-9]{6,12}-/i, '')

    if (next === result) break
    result = next
  }

  return result
}

export function buildStoredDocumentFileName(extension: string, kind: 'doc' | 'pdf' | 'drv') {
  const safeExtension = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`
  const stamp = Date.now().toString(36)
  const id = randomUUID().replace(/-/g, '').slice(0, 10)
  return `${kind}-${stamp}-${id}${safeExtension}`
}

export function toSafeDownloadPdfName(fileUrl: string) {
  const normalized = normalizeStoredDocumentUrl(fileUrl)
  const baseName = path.basename(normalized, path.extname(normalized))
  const withoutGeneratedPrefixes = stripGeneratedPrefixes(baseName)
  const safeStem = sanitizeFileStem(withoutGeneratedPrefixes || baseName, 50)
  return `${safeStem || 'documento'}.pdf`
}