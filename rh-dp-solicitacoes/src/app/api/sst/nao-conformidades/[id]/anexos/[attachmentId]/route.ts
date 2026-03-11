import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const { id, attachmentId } = await params
    const [nc, attachment] = await Promise.all([
      prisma.nonConformity.findUnique({ where: { id }, select: { solicitanteId: true } }),
      prisma.nonConformityAttachment.findUnique({ where: { id: attachmentId } }),
    ])

    if (!nc || !attachment || attachment.nonConformityId !== id) {
      return NextResponse.json({ error: 'Anexo não encontrado.' }, { status: 404 })
    }

    if (!hasMinLevel(level, ModuleLevel.NIVEL_2) && nc.solicitanteId !== me.id) {
      return NextResponse.json({ error: 'Sem acesso ao anexo.' }, { status: 403 })
    }

    const normalizedUrl = String(attachment.url || '').replace(/^\/+/, '')
    const absPath = path.join(process.cwd(), 'public', normalizedUrl)
    const fileBuffer = await readFile(absPath)

    const mimeType = attachment.mimeType || 'application/octet-stream'
    const isInline = mimeType === 'application/pdf' || mimeType.startsWith('image/')
    const dispositionType = isInline ? 'inline' : 'attachment'
    const fallbackName = attachment.filename?.trim() || 'anexo'
    const safeFileName = fallbackName.replace(/[\r\n"]/g, '_')
    const encodedFileName = encodeURIComponent(fallbackName)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(fileBuffer.byteLength),
        'Content-Disposition': `${dispositionType}; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`,
      },
    })
  } catch (error) {
    console.error('GET /api/sst/nao-conformidades/[id]/anexos/[attachmentId] error', error)
    return NextResponse.json({ error: 'Erro ao carregar anexo.' }, { status: 500 })
  }
}