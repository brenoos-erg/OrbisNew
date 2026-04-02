import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { validatePdfBuffer } from '@/lib/pdf/uncontrolledCopyWatermark'

const execFileAsync = promisify(execFile)
let cachedSofficeBinary: string | null = null

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

function getSofficeCandidates() {
  const libreOfficeEnvCandidate = process.env.LIBREOFFICE_PATH?.trim()
  const legacyEnvCandidate = process.env.SOFFICE_PATH?.trim()

  return [
    libreOfficeEnvCandidate,
    legacyEnvCandidate,
    'soffice',
    '/usr/bin/soffice',
    '/usr/local/bin/soffice',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  ].filter((candidate): candidate is string => Boolean(candidate))
}

async function resolveSofficeBinary() {
  if (cachedSofficeBinary) return cachedSofficeBinary

  const attemptedBinaries: string[] = []
  let lastError: unknown = null

  for (const binary of getSofficeCandidates()) {
    attemptedBinaries.push(binary)
    const candidateBinary = path.extname(binary).toLowerCase() === '.exe' || path.basename(binary).toLowerCase().includes('soffice')
      ? binary
      : path.join(binary, process.platform === 'win32' ? 'soffice.exe' : 'soffice')
    try {
      await execFileAsync(candidateBinary, ['--version'], {
        timeout: 20_000,
        maxBuffer: 2 * 1024 * 1024,
      })
      cachedSofficeBinary = candidateBinary
      return candidateBinary
    } catch (error) {
     lastError = error
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
  const sourceBaseName = path.basename(sourceAbsolutePath, path.extname(sourceAbsolutePath))

  const derivedDir = path.join(process.cwd(), 'public', 'uploads', 'documents-derived')
  await fs.mkdir(derivedDir, { recursive: true })
  await fs.access(derivedDir, fs.constants.W_OK)

  const cacheKey = toDerivedCacheKey(fileUrl, sourceStat)
  const derivedFileName = `${sourceBaseName}-${cacheKey}.pdf`
  const derivedAbsolutePath = path.join(derivedDir, derivedFileName)

  const cachedPdf = await fs.readFile(derivedAbsolutePath).catch(() => null)
  if (cachedPdf) {
    try {
      assertValidPdf(cachedPdf, { fileUrl, stage: 'cache' })
      console.info('[documents.word-to-pdf] using-derived-cache', { fileUrl, derivedAbsolutePath, bytes: cachedPdf.length })
      return {
        pdfBuffer: cachedPdf,
        outputFileName: `${sourceBaseName}.pdf`,
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
    const tempInputName = path.basename(sourceAbsolutePath)
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
      outputFileName: `${sourceBaseName}.pdf`,
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