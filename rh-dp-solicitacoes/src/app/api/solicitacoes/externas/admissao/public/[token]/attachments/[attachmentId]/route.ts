import { readFile } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EXTERNAL_ADMISSION_TYPE_ID, toTokenHash } from '@/lib/externalAdmission'
import { getInlineMimeType, resolveExistingAttachmentPath } from '@/lib/files/attachmentStorage'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; attachmentId: string }> },
) {
  const { token, attachmentId } = await params

  const solicitation = await prisma.solicitation.findFirst({
    where: {
      tipoId: EXTERNAL_ADMISSION_TYPE_ID,
      payload: { path: '$.externalAdmission.tokenHash', equals: toTokenHash(token) },
    },
    select: { id: true },
  })

  if (!solicitation) {
    return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  }

  const attachment = await prisma.attachment.findFirst({
    where: {
      id: attachmentId,
      solicitationId: solicitation.id,
    },
  })

  if (!attachment) {
    return NextResponse.json({ error: 'Anexo não encontrado.' }, { status: 404 })
  }

  const resolved = await resolveExistingAttachmentPath(attachment.url)
  if (!resolved) {
    return NextResponse.json({ error: 'Arquivo do anexo não encontrado.' }, { status: 404 })
  }

  try {
    const fileBuffer = await readFile(resolved.absolutePath)
    const mimeType = getInlineMimeType(attachment.mimeType, attachment.filename)
    const encodedName = encodeURIComponent(attachment.filename)
    const explicitDisposition = req.nextUrl.searchParams.get('disposition')
    const disposition =
      explicitDisposition === 'attachment'
        ? 'attachment'
        : mimeType === 'application/pdf' || mimeType.startsWith('image/')
        ? 'inline'
        : 'attachment'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(fileBuffer.byteLength),
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, max-age=0, no-cache',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Arquivo do anexo não encontrado.' }, { status: 404 })
  }
}
