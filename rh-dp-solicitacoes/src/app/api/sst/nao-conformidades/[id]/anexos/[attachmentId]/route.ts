import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { readFile } from 'node:fs/promises'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { canUserAccessNc, getUserCostCenterIds } from '@/lib/sst/nonConformityAccess'
import { getInlineMimeType, resolveExistingAttachmentPath } from '@/lib/files/attachmentStorage'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const { attachmentId } = await params
    const attachment = await prisma.nonConformityAttachment.findUnique({ where: { id: attachmentId } })
    if (!attachment) {
      return NextResponse.json({ error: 'Anexo não encontrado.' }, { status: 404 })
    }
    const nc = await prisma.nonConformity.findUnique({
      where: { id: attachment.nonConformityId },
      select: {
        solicitanteId: true,
        centroQueDetectouId: true,
        centroQueOriginouId: true,
      },
    })
    if (!nc) return NextResponse.json({ error: 'Anexo não encontrado.' }, { status: 404 })

    const userCostCenterIds = hasMinLevel(level, ModuleLevel.NIVEL_2) ? [] : await getUserCostCenterIds(me.id)
    const canAccess = canUserAccessNc({
      userId: me.id,
      level,
      ncSolicitanteId: nc.solicitanteId,
      centroQueDetectouId: nc.centroQueDetectouId,
      centroQueOriginouId: nc.centroQueOriginouId,
      userCostCenterIds,
    })
    if (!canAccess) {
       return NextResponse.json({ error: 'Sem acesso ao anexo.' }, { status: 403 })
    }

    const resolved = await resolveExistingAttachmentPath(attachment.url)
    if (!resolved) {
      return NextResponse.json({ error: 'Arquivo do anexo não encontrado.' }, { status: 404 })
    }

    const fileBuffer = await readFile(resolved.absolutePath)

    const mimeType = getInlineMimeType(attachment.mimeType, attachment.filename)
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