import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse, type NextRequest } from 'next/server'

import { requireActiveUser } from '@/lib/auth'
import { resolveDocumentVersionAccess } from '@/lib/documentVersionAccess'
import { applyUncontrolledCopyWatermark } from '@/lib/pdf/uncontrolledCopyWatermark'

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

  const access = await resolveDocumentVersionAccess(versionId, me.id)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  if ('termChallenge' in access) return NextResponse.json(access.termChallenge, { status: access.status })

  const normalized = normalizeStoredUrl(access.fileUrl)
  const absolutePath = path.join(process.cwd(), 'public', normalized)

  try {
    const fileBuffer = await readFile(absolutePath)
    const watermarkedBuffer = applyUncontrolledCopyWatermark(fileBuffer)
    const filename = path.basename(normalized)
    const encodedName = encodeURIComponent(filename)

    return new NextResponse(new Uint8Array(watermarkedBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, max-age=0, no-cache',
        'X-Document-Copy-Type': 'UNCONTROLLED',
        'X-Document-Watermark': 'CÓPIA NÃO CONTROLADA',
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
