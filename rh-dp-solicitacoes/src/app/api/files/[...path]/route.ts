import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'

const DOCUMENTS_ROOT = path.join(process.cwd(), 'public', 'uploads', 'documents')

function detectMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.svg') return 'image/svg+xml'
  return 'application/octet-stream'
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const rawParts = (await params).path || []
  if (rawParts.length === 0) {
    return NextResponse.json({ error: 'Arquivo não informado.' }, { status: 400 })
  }

  const safeParts = rawParts
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')

  if (safeParts.length !== rawParts.length) {
    return NextResponse.json({ error: 'Caminho inválido.' }, { status: 400 })
  }

  const absolutePath = path.join(DOCUMENTS_ROOT, ...safeParts)
  const relative = path.relative(DOCUMENTS_ROOT, absolutePath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return NextResponse.json({ error: 'Caminho inválido.' }, { status: 400 })
  }

  try {
    const fileStats = await stat(absolutePath)
    if (!fileStats.isFile()) {
      return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })
    }

    const mimeType = detectMimeType(absolutePath)
    const disposition = mimeType === 'application/pdf' || mimeType.startsWith('image/') ? 'inline' : 'attachment'
    const stream = createReadStream(absolutePath)

    return new NextResponse(Readable.toWeb(stream) as any, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(fileStats.size),
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(path.basename(absolutePath))}`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })
  }
}