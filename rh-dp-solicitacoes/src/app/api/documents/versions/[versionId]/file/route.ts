import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse, type NextRequest } from 'next/server'

import { requireActiveUser } from '@/lib/auth'
import { resolveDocumentVersionAccess } from '@/lib/documentVersionAccess'
import { applyUncontrolledCopyWatermark, validatePdfBuffer } from '@/lib/pdf/uncontrolledCopyWatermark'
import { DOCUMENT_PDF_MIME, isPdfBuffer, resolveDocumentFileType } from '@/lib/documents/fileType'
import { convertWordToPdf } from '@/lib/documents/wordToPdf'

function normalizeStoredUrl(url: string) {
  return url.startsWith('/') ? url : `/${url}`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const disposition = _req.nextUrl.searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline'
  const forcePdfFormat = _req.nextUrl.searchParams.get('format') === 'pdf'

  const access = await resolveDocumentVersionAccess(versionId, me.id)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  if ('termChallenge' in access) return NextResponse.json(access.termChallenge, { status: access.status })

  const normalized = normalizeStoredUrl(access.fileUrl)
  const absolutePath = path.join(process.cwd(), 'public', normalized)

  try {
    const fileBuffer = await readFile(absolutePath)
    const originalFileName = path.basename(normalized)
    const encodedOriginalName = encodeURIComponent(originalFileName)
    const fileType = resolveDocumentFileType(access.fileUrl)
    let pdfSource: Buffer | null = null
    let downloadName = originalFileName

    if (fileType.isPdf && isPdfBuffer(fileBuffer)) {
      pdfSource = Buffer.from(fileBuffer)
      downloadName = originalFileName
    } else if (fileType.isWord && forcePdfFormat) {
      try {
        const converted = await convertWordToPdf({
          fileUrl: access.fileUrl,
          sourceAbsolutePath: absolutePath,
        })
        pdfSource = converted.pdfBuffer
        downloadName = converted.outputFileName
      } catch (conversionError) {
        console.error('Falha ao converter documento Word para PDF.', {
          versionId,
          fileUrl: access.fileUrl,
          error: conversionError,
        })
        return NextResponse.json(
          { error: 'Não foi possível converter o documento Word para PDF no momento.' },
          { status: 422 },
        )
      }
    }

    if (!pdfSource) {
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': fileType.mimeType,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodedOriginalName}`,
          'Cache-Control': 'private, max-age=0, no-cache',
          'X-Document-File-Type': fileType.extension || 'unknown',
          'X-Document-Copy-Type': 'ORIGINAL',
          'X-Document-Watermark': 'NOT_APPLICABLE',
        },
      })
    }

    const encodedOutputName = encodeURIComponent(downloadName)
    const sourceValidation = validatePdfBuffer(pdfSource)
    if (!sourceValidation.valid) {
      console.error('Arquivo de documento inválido para visualização em PDF.', {
        versionId,
        fileUrl: access.fileUrl,
        reason: sourceValidation.reason,
      })

      return NextResponse.json(
        {
          error: 'O PDF armazenado está inválido para visualização no momento.',
        },
        { status: 422 },
      )
    }

    let outputBuffer: Buffer = Buffer.from(pdfSource)
    let watermarkApplied = false

    try {
      outputBuffer = applyUncontrolledCopyWatermark(pdfSource)
      watermarkApplied = true
    } catch (watermarkError) {
      console.warn("Falha ao aplicar marca d'água. Retornando PDF original.", {
        versionId,
        fileUrl: access.fileUrl,
        error: watermarkError,
      })
      outputBuffer = Buffer.from(pdfSource)
    }

    const outputValidation = validatePdfBuffer(outputBuffer)
    if (!outputValidation.valid) {
      console.error('PDF final inválido para resposta. Revertendo para PDF original.', {
        versionId,
        fileUrl: access.fileUrl,
        reason: outputValidation.reason,
      })
      outputBuffer = Buffer.from(pdfSource)
      watermarkApplied = false
    }

    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': DOCUMENT_PDF_MIME,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedOutputName}`,
        'Cache-Control': 'private, max-age=0, no-cache',
        'X-Document-Copy-Type': 'UNCONTROLLED',
        'X-Document-Watermark': watermarkApplied ? 'CÓPIA NÃO CONTROLADA' : 'UNAVAILABLE',
      },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Arquivo do documento não encontrado.' }, { status: 404 })
    }

    console.error("Erro ao carregar/aplicar marca d'água do documento", error)
    return NextResponse.json({ error: "Não foi possível gerar o arquivo com marca d'água." }, { status: 500 })
  }
}
