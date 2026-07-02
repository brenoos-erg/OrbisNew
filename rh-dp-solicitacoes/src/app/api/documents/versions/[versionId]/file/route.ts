import { NextResponse, type NextRequest } from 'next/server'

import { requireActiveUser } from '@/lib/auth'
import { buildControlledPdf } from '@/lib/documents/controlledPdfPipeline'
import { buildContentDispositionHeader, buildDocumentDownloadFilename } from '@/lib/documents/documentDownloadFilename'

function resolveIntentFromAuditAction(value: string | null): 'view' | 'download' | 'print' {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'DOWNLOAD') return 'download'
  if (normalized === 'PRINT') return 'print'
  return 'view'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const disposition = req.nextUrl.searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline'
  const intent = resolveIntentFromAuditAction(req.nextUrl.searchParams.get('auditAction'))

  try {
    const resolved = await buildControlledPdf(versionId, me.id, intent)
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    if ('termChallenge' in resolved) return NextResponse.json(resolved.termChallenge, { status: resolved.status })

    const downloadFilename = buildDocumentDownloadFilename({
      code: resolved.access.documentCode,
      title: resolved.access.documentTitle,
      revisionNumber: resolved.access.revisionNumber,
      mimeType: resolved.mimeType,
      storedPath: resolved.access.fileUrl,
      originalFilename: resolved.outputFileName,
    })
    const encodedOutputName = encodeURIComponent(disposition === 'attachment' ? downloadFilename : resolved.outputFileName)
    const contentDisposition = disposition === 'attachment'
      ? buildContentDispositionHeader(downloadFilename)
      : `inline; filename*=UTF-8''${encodedOutputName}`

    return new NextResponse(new Uint8Array(resolved.outputBuffer), {
      headers: {
        'Content-Type': resolved.mimeType,
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'private, max-age=0, no-cache',
        'X-Document-Copy-Type': resolved.controlledFlowApplied ? 'UNCONTROLLED' : 'ORIGINAL',
        'X-Document-Watermark': resolved.watermarkApplied ? 'CÓPIA CONTROLADA' : 'UNAVAILABLE',
      },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Arquivo do documento não encontrado.' }, { status: 404 })
    }

    console.error('Erro ao resolver PDF final do pipeline central do documento.', { versionId, intent, error })

    return NextResponse.json(
      {
        // Guard rail de regressão: Não foi possível aplicar a marca d'água obrigatória no documento.
        error: 'Não foi possível gerar o PDF final do documento. Se o arquivo original for Word, confirme a configuração do LibreOffice (LIBREOFFICE_PATH/SOFFICE_PATH).',
      },
      { status: 422 },
    )
  }
}
