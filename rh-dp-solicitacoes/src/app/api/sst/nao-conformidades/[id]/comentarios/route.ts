import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    if (!hasMinLevel(normalizeSstLevel(levels), ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const texto = String(body?.texto || '').trim()
    if (!texto) return NextResponse.json({ error: 'Comentário é obrigatório.' }, { status: 400 })

    const id = (await params).id
    const nc = await prisma.nonConformity.findUnique({ where: { id }, select: { id: true, solicitanteId: true } })
    if (!nc) return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.nonConformityComment.create({
        data: { nonConformityId: id, autorId: me.id, texto },
        include: { autor: { select: { id: true, fullName: true, email: true } } },
      })
      await tx.nonConformityTimeline.create({
        data: {
          nonConformityId: id,
          actorId: me.id,
          tipo: 'COMENTARIO',
          message: 'Comentário adicionado',
        },
      })
      return created
    })

     return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('POST /api/sst/nao-conformidades/[id]/comentarios error', error)
    return NextResponse.json({ error: 'Erro ao registrar comentário.', detail: devErrorDetail(error) }, { status: 500 })
  }
}