import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

type ConversionResult = {
  pdfBuffer: Buffer
  outputFileName: string
}

type ConversionOptions = {
  fileUrl: string
  sourceAbsolutePath: string
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

async function runSofficeConvert(args: string[]) {
  const attemptedBinaries: string[] = []
  let lastError: unknown = null

  for (const binary of getSofficeCandidates()) {
    attemptedBinaries.push(binary)
    const candidateBinary = path.extname(binary).toLowerCase() === '.exe' || path.basename(binary).toLowerCase().includes('soffice')
      ? binary
      : path.join(binary, process.platform === 'win32' ? 'soffice.exe' : 'soffice')
    try {
      await execFileAsync(candidateBinary, args, {
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
      })
      return
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { code?: string }
      if (err?.code === 'ENOENT') {
        lastError = error
        continue
      }


      throw error
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`LibreOffice (soffice) não encontrado. Caminhos tentados: ${attemptedBinaries.join(', ')}. Último erro: ${message}`)
}

function toDerivedCacheKey(fileUrl: string, sourceStat: Awaited<ReturnType<typeof fs.stat>>) {
  return createHash('sha1')
    .update(`${fileUrl}:${sourceStat.mtimeMs}:${sourceStat.size}`)
    .digest('hex')
    .slice(0, 12)
}

export async function convertWordToPdf({ fileUrl, sourceAbsolutePath }: ConversionOptions): Promise<ConversionResult> {
  await fs.access(sourceAbsolutePath)
  const sourceStat = await fs.stat(sourceAbsolutePath)
  const sourceBaseName = path.basename(sourceAbsolutePath, path.extname(sourceAbsolutePath))

  const derivedDir = path.join(process.cwd(), 'public', 'uploads', 'documents-derived')
  await fs.mkdir(derivedDir, { recursive: true })

  const cacheKey = toDerivedCacheKey(fileUrl, sourceStat)
  const derivedFileName = `${sourceBaseName}-${cacheKey}.pdf`
  const derivedAbsolutePath = path.join(derivedDir, derivedFileName)

  const cachedPdf = await fs.readFile(derivedAbsolutePath).catch(() => null)
  if (cachedPdf) {
    return {
      pdfBuffer: cachedPdf,
      outputFileName: `${sourceBaseName}.pdf`,
    }
  }
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'word-to-pdf-'))

  try {
    const tempInputName = path.basename(sourceAbsolutePath)
    const tempInputPath = path.join(tempDir, tempInputName)
    await fs.copyFile(sourceAbsolutePath, tempInputPath)

    await runSofficeConvert(['--headless', '--convert-to', 'pdf', '--outdir', tempDir, tempInputPath])

    const convertedTempPdfPath = path.join(tempDir, `${path.basename(tempInputName, path.extname(tempInputName))}.pdf`)
    const convertedPdf = await fs.readFile(convertedTempPdfPath).catch(() => null)
    if (!convertedPdf?.length) {
      throw new Error('Arquivo PDF convertido não foi gerado pelo LibreOffice.')
    }

    await fs.writeFile(derivedAbsolutePath, convertedPdf)

    return {
      pdfBuffer: convertedPdf,
      outputFileName: `${sourceBaseName}.pdf`,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Falha ao converter documento Word para PDF: ${detail}`)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}