import { NextResponse, type NextRequest } from 'next/server'

import { requireActiveUser } from '@/lib/auth'
import { buildControlledPdf } from '@/lib/documents/controlledPdfPipeline'

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

    const encodedOutputName = encodeURIComponent(resolved.outputFileName)

    return new NextResponse(new Uint8Array(resolved.outputBuffer), {
      headers: {
        'Content-Type': resolved.mimeType,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedOutputName}`,
        'Cache-Control': 'private, max-age=0, no-cache',
        'X-Document-Copy-Type': 'UNCONTROLLED',
        'X-Document-Watermark': resolved.watermarkApplied ? 'CÓPIA NÃO CONTROLADA' : 'UNAVAILABLE',
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
