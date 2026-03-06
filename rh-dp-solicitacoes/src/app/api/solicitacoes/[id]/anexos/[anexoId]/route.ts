import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse, type NextRequest } from 'next/server'

import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function normalizeStoredUrl(url: string) {
  return url.startsWith('/') ? url : `/${url}`
}

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

  const fileUrl = normalizeStoredUrl(attachment.url)
  const absolutePath = path.join(process.cwd(), 'public', fileUrl)

  try {
    const fileBuffer = await readFile(absolutePath)
    const encodedName = encodeURIComponent(attachment.filename)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, max-age=0, no-cache',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Arquivo do anexo não encontrado.' }, { status: 404 })
  }
}