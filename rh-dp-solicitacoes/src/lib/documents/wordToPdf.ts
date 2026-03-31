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

function toDerivedCacheKey(fileUrl: string, sourceStat: Awaited<ReturnType<typeof fs.stat>>) {
  return createHash('sha1')
    .update(`${fileUrl}:${sourceStat.mtimeMs}:${sourceStat.size}`)
    .digest('hex')
    .slice(0, 12)
}

export async function convertWordToPdf({ fileUrl, sourceAbsolutePath }: ConversionOptions): Promise<ConversionResult> {
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

    await execFileAsync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', tempDir, tempInputPath], {
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    })

    const convertedTempPdfPath = path.join(tempDir, `${path.basename(tempInputName, path.extname(tempInputName))}.pdf`)
    const convertedPdf = await fs.readFile(convertedTempPdfPath)

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