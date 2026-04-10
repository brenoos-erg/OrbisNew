import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'

const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads')

function detectMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.txt') return 'text/plain; charset=utf-8'
  if (ext === '.doc') return 'application/msword'
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === '.xls') return 'application/vnd.ms-excel'
  if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return 'application/octet-stream'
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  await requireActiveUser()

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

  const absolutePath = path.join(UPLOADS_ROOT, ...safeParts)
  const relative = path.relative(UPLOADS_ROOT, absolutePath)
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