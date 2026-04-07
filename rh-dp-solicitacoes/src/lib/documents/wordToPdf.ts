import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { validatePdfBuffer } from '@/lib/pdf/uncontrolledCopyWatermark'
import { toSafeDownloadPdfName } from '@/lib/documents/documentStorage'

const execFileAsync = promisify(execFile)
let cachedSofficeBinary: string | null = null
const WINDOWS_SOFFICE_ALLOWED_PATHS = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
] as const

type ConversionResult = {
  pdfBuffer: Buffer
  outputFileName: string
}
type ConversionOptions = {
  fileUrl: string
  sourceAbsolutePath: string
}
type SofficeResult = {
  binary: string
  args: string[]
  stdout: string
  stderr: string
}
type SofficeCandidate = {
  binary: string
  source: 'LIBREOFFICE_PATH' | 'SOFFICE_PATH' | 'auto-detected'
}


function sanitizeEnvPath(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.replace(/^"(.+)"$/, '$1')
}

function isWindowsPlatform() {
  return process.platform === 'win32'
}

function normalizeWindowsPath(value: string) {
  return value.replace(/\//g, '\\').toLowerCase()
}

function isWindowsExecutableCandidate(binary: string) {
  const lower = binary.trim().toLowerCase()
  if (!lower) return false
  if (lower.endsWith('.bat') || lower.endsWith('.cmd') || lower.endsWith('.lnk')) return false
  return lower.endsWith('.exe')
}

function isExplicitWindowsSofficePath(binary: string) {
  const normalized = normalizeWindowsPath(binary)
  return WINDOWS_SOFFICE_ALLOWED_PATHS.some((allowedPath) => normalizeWindowsPath(allowedPath) === normalized)
}

async function fileExistsReadable(filePath: string) {
  try {
    await fs.access(filePath, fsConstants.R_OK)
    return true
  } catch {
    return false
  }
}

function getSofficeCandidates(): SofficeCandidate[] {
  const libreOfficeEnvRaw = process.env.LIBREOFFICE_PATH
  const sofficeEnvRaw = process.env.SOFFICE_PATH
  const libreOfficeEnvCandidate = sanitizeEnvPath(libreOfficeEnvRaw)
  const legacyEnvCandidate = sanitizeEnvPath(sofficeEnvRaw)
  const windows = isWindowsPlatform()

  console.info('[documents.word-to-pdf] soffice-env-detection', {
    libreOfficePathRaw: libreOfficeEnvRaw ?? null,
    sofficePathRaw: sofficeEnvRaw ?? null,
    libreOfficePath: libreOfficeEnvCandidate ?? null,
    sofficePath: legacyEnvCandidate ?? null,
  })

 const candidates: SofficeCandidate[] = []
  if (libreOfficeEnvCandidate) candidates.push({ binary: libreOfficeEnvCandidate, source: 'LIBREOFFICE_PATH' })
  if (legacyEnvCandidate) candidates.push({ binary: legacyEnvCandidate, source: 'SOFFICE_PATH' })

  if (windows) {
    for (const binary of WINDOWS_SOFFICE_ALLOWED_PATHS) candidates.push({ binary, source: 'auto-detected' })
  } else {
    candidates.push(
      { binary: 'soffice', source: 'auto-detected' },
      { binary: '/usr/bin/soffice', source: 'auto-detected' },
      { binary: '/usr/local/bin/soffice', source: 'auto-detected' },
    )
  }

  const deduped = new Map<string, SofficeCandidate>()
  for (const candidate of candidates) {
    const key = windows ? normalizeWindowsPath(candidate.binary) : candidate.binary
    if (!deduped.has(key)) deduped.set(key, candidate)
  }
  return Array.from(deduped.values())
}

async function resolveSofficeBinary() {
  if (cachedSofficeBinary) return cachedSofficeBinary

  const attemptedBinaries: string[] = []
  let lastError: unknown = null

  for (const candidate of getSofficeCandidates()) {
    const candidateBinary = candidate.binary
    attemptedBinaries.push(candidateBinary)

    if (isWindowsPlatform()) {
      if (!isWindowsExecutableCandidate(candidateBinary)) {
        console.warn('[documents.word-to-pdf] soffice-candidate-rejected', {
          binary: candidateBinary,
          source: candidate.source,
          reason: 'windows-non-executable-or-wrapper',
        })
        continue
      }

      const baseName = path.basename(candidateBinary).toLowerCase()
      if (baseName !== 'soffice.exe') {
        console.warn('[documents.word-to-pdf] soffice-candidate-rejected', {
          binary: candidateBinary,
          source: candidate.source,
          reason: 'windows-basename-must-be-soffice.exe',
        })
        continue
      }

      if (!isExplicitWindowsSofficePath(candidateBinary)) {
        console.warn('[documents.word-to-pdf] soffice-candidate-rejected', {
          binary: candidateBinary,
          source: candidate.source,
          reason: 'windows-path-not-allowed',
          allowedPaths: WINDOWS_SOFFICE_ALLOWED_PATHS,
        })
         continue
      }

      const exists = await fileExistsReadable(candidateBinary)
      if (!exists) {
        console.warn('[documents.word-to-pdf] soffice-candidate-rejected', {
          binary: candidateBinary,
          source: candidate.source,
          reason: 'windows-soffice-exe-not-found',
        })
        continue
      }

      const fileStats = await fs.lstat(candidateBinary).catch(() => null)
      if (!fileStats?.isFile()) {
        console.warn('[documents.word-to-pdf] soffice-candidate-rejected', {
          binary: candidateBinary,
          source: candidate.source,
          reason: 'windows-candidate-not-a-file',
        })
        continue
      }

      if (fileStats.isSymbolicLink()) {
        console.warn('[documents.word-to-pdf] soffice-candidate-rejected', {
          binary: candidateBinary,
          source: candidate.source,
          reason: 'windows-symlink-not-allowed',
        })
        continue
      }

      cachedSofficeBinary = candidateBinary
      console.info('[documents.word-to-pdf] soffice-candidate-selected', {
        binary: candidateBinary,
        source: candidate.source,
        platform: 'win32',
      })
      return candidateBinary
    }

    try {
      await execFileAsync(candidateBinary, ['--version'], {
        timeout: 20_000,
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true,
      })
      cachedSofficeBinary = candidateBinary
      console.info('[documents.word-to-pdf] soffice-candidate-selected', {
        binary: candidateBinary,
        source: candidate.source,
      })
      return candidateBinary
    } catch (error) {
      lastError = error
      const err = error as NodeJS.ErrnoException
      console.warn('[documents.word-to-pdf] soffice-candidate-failed', {
        binary: candidateBinary,
        source: candidate.source,
        code: err?.code ?? 'n/a',
        message: err?.message ?? String(error),
      })
      continue
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`LibreOffice (soffice) não encontrado. Caminhos tentados: ${attemptedBinaries.join(', ')}. Último erro: ${message}`)
}
function trimCommandOutput(value: string) {
  const normalized = value.trim()
  if (!normalized) return ''
  if (normalized.length <= 4_000) return normalized
  return `${normalized.slice(0, 4_000)}…[truncated]`
}

async function runSofficeConvert(args: string[]): Promise<SofficeResult> {
  const binary = await resolveSofficeBinary()
  console.info('[documents.word-to-pdf] converting-with-soffice', { binary, args })

  try {
    const result = await execFileAsync(binary, args, {
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    })
    return {
      binary,
      args,
      stdout: trimCommandOutput(result.stdout),
      stderr: trimCommandOutput(result.stderr),
    }
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string; code?: number | string; signal?: NodeJS.Signals }
    const stdout = trimCommandOutput(typeof err.stdout === 'string' ? err.stdout : '')
    const stderr = trimCommandOutput(typeof err.stderr === 'string' ? err.stderr : '')
    const detail = err.message || String(error)
    throw new Error(
      `Falha ao executar LibreOffice (${binary}) para conversão: ${detail}. ` +
      `code=${String(err.code ?? 'n/a')} signal=${String(err.signal ?? 'n/a')} stdout="${stdout}" stderr="${stderr}"`,
    ) 
   }
}

function toDerivedCacheKey(fileUrl: string, sourceStat: Awaited<ReturnType<typeof fs.stat>>) {
  return createHash('sha1')
    .update(`${fileUrl}:${sourceStat.mtimeMs}:${sourceStat.size}`)
    .digest('hex')
    .slice(0, 12)
}

function assertValidPdf(buffer: Buffer, context: { fileUrl: string; stage: 'cache' | 'conversion' }) {
  const validation = validatePdfBuffer(buffer)
  if (validation.valid) return

  throw new Error(`PDF inválido após ${context.stage}: ${validation.reason} (${context.fileUrl}).`)
}

export async function convertWordToPdf({ fileUrl, sourceAbsolutePath }: ConversionOptions): Promise<ConversionResult> {
  await fs.access(sourceAbsolutePath, fs.constants.R_OK)
  const sourceStat = await fs.stat(sourceAbsolutePath)
  const outputFileName = toSafeDownloadPdfName(fileUrl)

  const derivedDir = path.join(process.cwd(), 'public', 'uploads', 'documents-derived')
  await fs.mkdir(derivedDir, { recursive: true })
  await fs.access(derivedDir, fs.constants.W_OK)

  const cacheKey = toDerivedCacheKey(fileUrl, sourceStat)
  const derivedFileName = `drv-${cacheKey}.pdf`
  const derivedAbsolutePath = path.join(derivedDir, derivedFileName)

  const cachedPdf = await fs.readFile(derivedAbsolutePath).catch(() => null)
  if (cachedPdf) {
    try {
      assertValidPdf(cachedPdf, { fileUrl, stage: 'cache' })
      console.info('[documents.word-to-pdf] using-derived-cache', { fileUrl, derivedAbsolutePath, bytes: cachedPdf.length })
      return {
        pdfBuffer: cachedPdf,
        outputFileName,
      }
    } catch (error) {
      console.warn('[documents.word-to-pdf] cache-invalid-reconvert', {
        fileUrl,
        derivedAbsolutePath,
        detail: error instanceof Error ? error.message : String(error),
      })
      await fs.rm(derivedAbsolutePath, { force: true })
    }
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'word-to-pdf-'))

  try {
    const sourceExtension = path.extname(sourceAbsolutePath).toLowerCase() || '.docx'
    const tempInputName = `input${sourceExtension}`
    const tempInputPath = path.join(tempDir, tempInputName)
    await fs.copyFile(sourceAbsolutePath, tempInputPath)

  const sofficeResult = await runSofficeConvert(['--headless', '--nologo', '--nolockcheck', '--convert-to', 'pdf:writer_pdf_Export', '--outdir', tempDir, tempInputPath])
    if (sofficeResult.stdout || sofficeResult.stderr) {
      console.info('[documents.word-to-pdf] soffice-output', {
        fileUrl,
        stdout: sofficeResult.stdout,
        stderr: sofficeResult.stderr,
      })
    }

    const convertedTempPdfPath = path.join(tempDir, `${path.basename(tempInputName, path.extname(tempInputName))}.pdf`)
    let convertedPdf = await fs.readFile(convertedTempPdfPath).catch(() => null)
    if (!convertedPdf?.length) {
      const tempFiles = await fs.readdir(tempDir).catch(() => [])
      const fallbackPdfName = tempFiles.find((file) => file.toLowerCase().endsWith('.pdf'))
      if (fallbackPdfName) {
        convertedPdf = await fs.readFile(path.join(tempDir, fallbackPdfName)).catch(() => null)
      }
    }
    if (!convertedPdf?.length) {
      throw new Error('Arquivo PDF convertido não foi gerado pelo LibreOffice.')
    }

    assertValidPdf(convertedPdf, { fileUrl, stage: 'conversion' })

    await fs.writeFile(derivedAbsolutePath, convertedPdf)
    console.info('[documents.word-to-pdf] conversion-finished', {
      fileUrl,
      sourceAbsolutePath,
      tempInputPath,
      derivedAbsolutePath,
      outputBytes: convertedPdf.length,
    })

    return {
      pdfBuffer: convertedPdf,
      outputFileName,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[documents.word-to-pdf] conversion-failed', {
      fileUrl,
      sourceAbsolutePath,
      detail,
    })
      throw new Error(`Falha ao converter documento Word para PDF: ${detail}. Verifique se o LibreOffice (soffice) está instalado e acessível.`)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

export const convertDocumentToPdf = convertWordToPdf