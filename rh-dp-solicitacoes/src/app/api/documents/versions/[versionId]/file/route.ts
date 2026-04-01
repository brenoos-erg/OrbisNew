import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse, type NextRequest } from 'next/server'

import { requireActiveUser } from '@/lib/auth'
import { resolveDocumentVersionAccess } from '@/lib/documentVersionAccess'
import { applyUncontrolledCopyWatermark, hasUncontrolledCopyWatermark, validatePdfBuffer } from '@/lib/pdf/uncontrolledCopyWatermark'
import { DOCUMENT_PDF_MIME, isPdfBuffer, resolveDocumentFileType } from '@/lib/documents/fileType'
import { convertDocumentToPdf } from '@/lib/documents/wordToPdf'

function normalizeStoredUrl(url: string) {
  return url.startsWith('/') ? url : `/${url}`
}
function toPublicAbsolutePath(fileUrl: string) {
  const normalized = normalizeStoredUrl(fileUrl)
  const relativeToPublic = normalized.replace(/^\/+/, '')
  return path.join(process.cwd(), 'public', relativeToPublic)
}

function resolveIntentFromAuditAction(value: string | null): 'view' | 'download' | 'print' {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'DOWNLOAD') return 'download'
  if (normalized === 'PRINT') return 'print'
  return 'view'
}


export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const disposition = _req.nextUrl.searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline'
  const intent = resolveIntentFromAuditAction(_req.nextUrl.searchParams.get('auditAction'))
  const access = await resolveDocumentVersionAccess(versionId, me.id, intent)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  if ('termChallenge' in access) return NextResponse.json(access.termChallenge, { status: access.status })

   const normalized = normalizeStoredUrl(access.fileUrl)
  const absolutePath = toPublicAbsolutePath(access.fileUrl)

  try {
    const fileBuffer = await readFile(absolutePath)
    const originalFileName = path.basename(normalized)
    const fileType = resolveDocumentFileType(access.fileUrl)
    let pdfSource: Buffer | null = null
    let downloadName = originalFileName

    if (fileType.isPdf && isPdfBuffer(fileBuffer)) {
      pdfSource = Buffer.from(fileBuffer)
      downloadName = originalFileName
    } else if (fileType.isConvertibleToPdf) {
      try {
        const converted = await convertDocumentToPdf({
          fileUrl: access.fileUrl,
          sourceAbsolutePath: absolutePath,
        })
        pdfSource = converted.pdfBuffer
        downloadName = converted.outputFileName
      } catch (conversionError) {
        console.error('Falha ao converter documento para PDF.', {
          versionId,
          fileUrl: access.fileUrl,
          error: conversionError,
        })
        return NextResponse.json(
          { error: 'Não foi possível converter o documento para PDF no momento.' },
          { status: 422 },
        )
      }
    }


    if (!pdfSource) {
      return NextResponse.json(
        {
          error: `Formato ${fileType.extension || 'desconhecido'} não suportado para emissão como cópia não controlada.`,
        },
        { status: 422 },
      )
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
    let watermarkApplied = hasUncontrolledCopyWatermark(pdfSource)

    if (!watermarkApplied) {
      try {
        outputBuffer = applyUncontrolledCopyWatermark(pdfSource)
        watermarkApplied = true
      } catch (watermarkError) {
      console.error("Falha ao aplicar marca d'água obrigatória no documento.", {
        versionId,
        fileUrl: access.fileUrl,
        error: watermarkError,
      })
      return NextResponse.json(
          {
            error: "Não foi possível aplicar a marca d'água obrigatória no documento.",
          },
          { status: 422 },
        )
      }
    }

    const outputValidation = validatePdfBuffer(outputBuffer)
    if (!outputValidation.valid) {
      console.error('PDF final inválido após marca d\'água obrigatória.', {
        versionId,
        fileUrl: access.fileUrl,
        reason: outputValidation.reason,
      })
      return NextResponse.json(
        {
          error: 'Não foi possível gerar o PDF com marca d\'água obrigatória.',
        },
        { status: 422 },
      )
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
