import { NextRequest, NextResponse } from 'next/server'
import { Action, ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'
import { canUserAccessNc, getUserCostCenterIds } from '@/lib/sst/nonConformityAccess'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }
    await assertCanFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.COMENTARIOS, Action.UPDATE)

    const body = await req.json().catch(() => ({} as any))
    const texto = String(body?.texto || '').trim()
    if (!texto) return NextResponse.json({ error: 'Comentário é obrigatório.' }, { status: 400 })

    const id = (await params).id
    const nc = await prisma.nonConformity.findUnique({
      where: { id },
      select: { id: true, solicitanteId: true, centroQueDetectouId: true, centroQueOriginouId: true },
    })
    if (!nc) return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })

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
      return NextResponse.json({ error: 'Sem permissão para comentar nesta NC.' }, { status: 403 })
    }
    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.nonConformityComment.create({
        data: { nonConformityId: id, autorId: me.id, texto },
        include: { autor: { select: { id: true, fullName: true, email: true } } },
      })
       await appendNonConformityTimelineEvent(tx, {
        nonConformityId: id,
        actorId: me.id,
        tipo: 'COMENTARIO',
        message: 'Comentário adicionado',
      })
      return created
    })

     return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('POST /api/sst/nao-conformidades/[id]/comentarios error', error)
    return NextResponse.json({ error: 'Erro ao registrar comentário.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
