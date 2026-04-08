import { readFile } from 'node:fs/promises'
import { NextResponse, type NextRequest } from 'next/server'

import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getInlineMimeType, resolveExistingAttachmentPath } from '@/lib/files/attachmentStorage'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; anexoId: string }> },
) {
  await requireActiveUser()

  const { id: solicitationId, anexoId } = await params

  const attachment = await prisma.attachment.findFirst({
    where: {
      id: anexoId,
      solicitationId,
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
    const disposition = mimeType === 'application/pdf' || mimeType.startsWith('image/') ? 'inline' : 'attachment'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, max-age=0, no-cache',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Arquivo do anexo não encontrado.' }, { status: 404 })
  }
}