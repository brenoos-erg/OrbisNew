export const dynamic = 'force-dynamic'

import path from 'node:path'
import fs from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string; documentId: string }> }

function canDownloadPositionDocument(user: Awaited<ReturnType<typeof requireActiveUser>>) {
  return (
    user.role === 'ADMIN' ||
    user.role === 'RH' ||
    user.moduleLevels?.configuracoes === 'NIVEL_3'
  )
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const me = await requireActiveUser()
    if (!canDownloadPositionDocument(me)) {
      return NextResponse.json(
        { error: 'Apenas RH, administradores ou usuários de Configurações nível 3 podem baixar documentos de cargo.' },
        { status: 403 },
      )
    }

    const { id, documentId } = await params
    const doc = await prisma.positionDocument.findFirst({ where: { id: documentId, positionId: id } })
    if (!doc) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })

    const buffer = await fs.readFile(path.join(process.cwd(), 'public', 'uploads', 'position-documents', doc.storedFilename))
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': doc.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.originalFilename)}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/positions/[id]/documents/[documentId]/download error', error)
    return NextResponse.json({ error: 'Erro ao baixar documento do cargo.' }, { status: 500 })
  }
}
