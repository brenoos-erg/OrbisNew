import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

export function normalizeStoredDocumentUrl(url: string) {
  const slashNormalized = String(url ?? '').replace(/\\/g, '/').trim()
  if (!slashNormalized) return '/'
  return slashNormalized.startsWith('/') ? slashNormalized : `/${slashNormalized}`
}

function decodePathStrict(value: string) {
  let current = value
  for (let index = 0; index < 3; index += 1) {
    const decoded = decodeURIComponent(current)
    if (decoded === current) return decoded
    current = decoded
  }
  return current
}

function assertSafePublicReference(rawValue: string) {
  if (rawValue.includes('\\') || rawValue.includes('\0')) throw new Error('Referência pública inválida.')
  const decoded = decodePathStrict(rawValue)
  if (decoded.includes('\\') || decoded.includes('\0') || /(^|[\/])\.\.([\/]|$)/.test(decoded) || path.isAbsolute(decoded) || /^[/\\]{2}/.test(decoded) || /^[a-zA-Z]:[\/]/.test(decoded)) {
    throw new Error('Referência pública inválida.')
  }
  return decoded
}

function toAbsoluteFromPublicUrl(fileUrl: string) {
  const safeUrl = assertSafePublicReference(String(fileUrl ?? ''))
  const normalized = normalizeStoredDocumentUrl(safeUrl)
  const relativeToPublic = normalized.replace(/^\/+/, '')
  if (normalized.includes('\0') || /(^|\/)\.\.(\/|$)/.test(normalized) || path.isAbsolute(relativeToPublic) || /^\/\//.test(normalized) || /^[a-zA-Z]:/.test(relativeToPublic)) {
    throw new Error('Referência pública inválida.')
  }
  const publicRoot = path.resolve(process.cwd(), 'public')
  const absolutePath = path.resolve(publicRoot, ...relativeToPublic.split('/'))
  if (absolutePath !== publicRoot && !absolutePath.startsWith(`${publicRoot}${path.sep}`)) throw new Error('Referência pública inválida.')
  return absolutePath
}

export async function resolvePublicDocumentPath(fileUrl: string) {
  const safeUrl = assertSafePublicReference(String(fileUrl ?? ''))
  const normalized = normalizeStoredDocumentUrl(safeUrl)

  const decodedCandidate = (() => {
    try {
      const decoded = decodePathStrict(normalized)
      if (decoded.includes('\0') || /(^|\/)\.\.(\/|$)/.test(decoded) || /^\/\//.test(decoded) || /^[a-zA-Z]:/.test(decoded.replace(/^\/+/, ''))) throw new Error('invalid decoded path')
      return decoded === normalized ? null : decoded
    } catch {
      return null
    }
  })()

  const urlCandidates = [normalized, decodedCandidate].filter((value): value is string => Boolean(value))
  const attemptedAbsolutePaths: string[] = []

  for (const candidate of urlCandidates) {
    let absolutePath: string
    try {
      absolutePath = toAbsoluteFromPublicUrl(candidate)
    } catch {
      continue
    }
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
      // Private source fallback for sourceStorageKey references passed to the existing PDF pipeline.
      try {
        const privatePath = path.resolve(process.cwd(), 'storage', 'documents', 'source', candidate.replace(/^\/+/, ''))
        attemptedAbsolutePaths.push(privatePath)
        const privateRoot = path.resolve(process.cwd(), 'storage', 'documents', 'source')
        if (privatePath === privateRoot || !privatePath.startsWith(`${privateRoot}${path.sep}`)) throw new Error('invalid private source path')
        await fs.access(privatePath, fs.constants.R_OK)
        return { exists: true as const, resolvedFileUrl: candidate, absolutePath: privatePath, attemptedAbsolutePaths }
      } catch {
        continue
      }
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

export const MAX_PRIVATE_SOURCE_FILE_BYTES = Number(process.env.DOCUMENT_SOURCE_MAX_BYTES ?? 50 * 1024 * 1024)

const SOURCE_MIME_BY_EXTENSION: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword', 'application/octet-stream'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream'],
  '.xls': ['application/vnd.ms-excel', 'application/octet-stream'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream'],
}

function resolveMagicBytes(buffer: Buffer) {
  if (buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) return 'pdf'
  if (buffer.subarray(0, 2).equals(Buffer.from([0x50, 0x4b]))) return 'zip-office'
  if (buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return 'ole-office'
  return 'unknown'
}

export function validatePrivateSourceFile(input: { originalName?: string | null; mimeType?: string | null; buffer: Buffer }) {
  const extension = path.extname(input.originalName || '').toLowerCase()
  if (!SOURCE_MIME_BY_EXTENSION[extension]) throw new Error('Extensão de arquivo original não permitida.')
  if (input.buffer.byteLength <= 0) throw new Error('Arquivo original vazio.')
  if (input.buffer.byteLength > MAX_PRIVATE_SOURCE_FILE_BYTES) throw new Error('Arquivo original excede o limite permitido.')

  const mimeType = String(input.mimeType || 'application/octet-stream').toLowerCase()
  if (!SOURCE_MIME_BY_EXTENSION[extension].includes(mimeType)) throw new Error('MIME do arquivo original incompatível com a extensão.')

  const magic = resolveMagicBytes(input.buffer)
  const expectedMagic = extension === '.pdf' ? 'pdf' : ['.doc', '.xls'].includes(extension) ? 'ole-office' : 'zip-office'
  if (magic !== expectedMagic) throw new Error('Assinatura do arquivo original incompatível com a extensão informada.')

  return { extension, mimeType, magic, sizeBytes: input.buffer.byteLength, sha256: createHash('sha256').update(input.buffer).digest('hex') }
}

export const PRIVATE_DOCUMENT_SOURCE_ROOT = path.join(process.cwd(), 'storage', 'documents', 'source')

export function normalizePrivateDocumentStorageKey(value: string) {
  const normalized = String(value ?? '').replace(/\\/g, '/').trim().replace(/^\/+/, '')
  if (!normalized) throw new Error('Referência do arquivo original inválida.')
  if (normalized.includes('\0') || normalized.split('/').some((part) => part === '..')) {
    throw new Error('Referência do arquivo original inválida.')
  }
  return normalized
}

export function buildPrivateSourceStorageKey(fileName: string) {
  return normalizePrivateDocumentStorageKey(fileName)
}

export async function savePrivateDocumentSourceFile(file: File, kind: 'doc' | 'pdf' | 'drv' = 'doc') {
  await fs.mkdir(PRIVATE_DOCUMENT_SOURCE_ROOT, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  const validation = validatePrivateSourceFile({ originalName: file.name, mimeType: file.type, buffer })
  const safeName = buildStoredDocumentFileName(validation.extension, kind)
  const storageKey = buildPrivateSourceStorageKey(safeName)
  const tempPath = path.join(PRIVATE_DOCUMENT_SOURCE_ROOT, `${storageKey}.tmp`)
  const absolutePath = path.join(PRIVATE_DOCUMENT_SOURCE_ROOT, storageKey)
  await fs.writeFile(tempPath, buffer)
  try {
    await fs.rename(tempPath, absolutePath)
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined)
    throw error
  }
  return { storageKey, originalName: file.name || safeName, mimeType: validation.mimeType, size: validation.sizeBytes, sha256: validation.sha256 }
}

export async function resolvePrivateDocumentSourcePath(storageKey: string) {
  const normalized = normalizePrivateDocumentStorageKey(storageKey)
  const absolutePath = path.resolve(PRIVATE_DOCUMENT_SOURCE_ROOT, normalized)
  const root = path.resolve(PRIVATE_DOCUMENT_SOURCE_ROOT)
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error('Referência do arquivo original inválida.')
  }
  await fs.access(absolutePath, fs.constants.R_OK)
  return { storageKey: normalized, absolutePath }
}

export function resolveSafeOriginalFilename(input: { code?: string | null; revisionNumber?: number | null; storageKey?: string | null; originalName?: string | null }) {
  const extension = path.extname(input.originalName || input.storageKey || '').toLowerCase() || '.bin'
  const base = sanitizeFileStem(`${input.code || 'documento'}-REV${String(input.revisionNumber ?? 0).padStart(2, '0')}`, 80)
  return `${base}${extension}`
}

export async function removePrivateDocumentSourceFile(storageKey: string) {
  const resolved = await resolvePrivateDocumentSourcePath(storageKey).catch(() => null)
  if (!resolved) return
  await fs.rm(resolved.absolutePath, { force: true })
}

export const PRIVATE_DOCUMENT_PUBLISHED_ROOT = path.join(process.cwd(), 'storage', 'documents', 'published')

export async function copyPrivateDocumentSourceToPublished(storageKey: string, extension = '.bin') {
  const source = await resolvePrivateDocumentSourcePath(storageKey)
  return copyAbsolutePathToPublished(source.absolutePath, extension)
}

export async function copyAbsolutePathToPublished(sourcePath: string, extension = '.bin') {
  await fs.mkdir(PRIVATE_DOCUMENT_PUBLISHED_ROOT, { recursive: true })
  const safeName = buildStoredDocumentFileName(extension, 'pdf')
  const targetPath = path.join(PRIVATE_DOCUMENT_PUBLISHED_ROOT, safeName)
  const tempPath = `${targetPath}.tmp`
  await fs.copyFile(sourcePath, tempPath)
  try {
    await fs.rename(tempPath, targetPath)
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined)
    throw error
  }
  const buffer = await fs.readFile(targetPath)
  return {
    storageKey: safeName,
    fileUrl: `private-published:${safeName}`,
    originalName: safeName,
    mimeType: extension.toLowerCase() === '.pdf' ? 'application/pdf' : 'application/octet-stream',
    sizeBytes: BigInt(buffer.byteLength),
    sha256: createHash('sha256').update(buffer).digest('hex'),
  }
}

export async function resolvePrivateDocumentPublishedPath(storageKey: string) {
  const normalized = normalizePrivateDocumentStorageKey(storageKey)
  const absolutePath = path.resolve(PRIVATE_DOCUMENT_PUBLISHED_ROOT, normalized)
  const root = path.resolve(PRIVATE_DOCUMENT_PUBLISHED_ROOT)
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) throw new Error('Referência publicada inválida.')
  await fs.access(absolutePath, fs.constants.R_OK)
  return { storageKey: normalized, absolutePath }
}

export async function removePrivateDocumentPublishedFile(storageKey: string) {
  const normalized = normalizePrivateDocumentStorageKey(storageKey)
  const absolutePath = path.resolve(PRIVATE_DOCUMENT_PUBLISHED_ROOT, normalized)
  const root = path.resolve(PRIVATE_DOCUMENT_PUBLISHED_ROOT)
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) throw new Error('Referência publicada inválida.')
  await fs.rm(absolutePath, { force: true }).catch(() => undefined)
}
