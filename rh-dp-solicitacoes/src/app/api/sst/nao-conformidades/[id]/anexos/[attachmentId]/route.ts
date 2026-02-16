import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
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

  return NextResponse.redirect(new URL(attachment.url, _req.url))
}