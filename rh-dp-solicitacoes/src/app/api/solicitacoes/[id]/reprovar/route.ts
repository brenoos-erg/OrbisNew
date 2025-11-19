// src/app/api/solicitacoes/[id]/reprovar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import crypto from 'crypto'
import { assertUserMinLevel } from '@/lib/access'
import { ModuleLevel } from '@prisma/client'

export const dynamic = 'force-dynamic'

type RouteParams = {
  params: { id: string }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const me = await requireActiveUser()
    const { id: solicitationId } = params

    // 🔐 Só NIVEL_3 no módulo "solicitacoes" pode reprovar
    await assertUserMinLevel(me.id, 'solicitacoes', ModuleLevel.NIVEL_3)

    const body = await req.json().catch(() => ({}))
    const comment: string | undefined = body.comment

    if (!comment || comment.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comentário é obrigatório para reprovar.' },
        { status: 400 },
      )
    }

    // 1) Busca a solicitação
    const solicit = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
    })

    if (!solicit) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    if (!solicit.requiresApproval || solicit.approvalStatus !== 'PENDENTE') {
      return NextResponse.json(
        { error: 'Solicitação não está pendente de aprovação.' },
        { status: 400 },
      )
    }

    // Opcional: se tiver um aprovador definido, só ele pode reprovar
    if (solicit.approverId && solicit.approverId !== me.id) {
      return NextResponse.json(
        { error: 'Você não é o aprovador desta solicitação.' },
        { status: 403 },
      )
    }

    // 2) Atualiza como REPROVADO
    const updated = await prisma.solicitation.update({
      where: { id: solicitationId },
      data: {
        approvalStatus: 'REPROVADO',
        approvalAt: new Date(),
        approvalComment: comment,
        requiresApproval: false,
        status: 'CANCELADA',
      },
    })

    // 3) Registra evento
    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        actorId: me.id,
        tipo: 'REPROVACAO',
      },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('POST /api/solicitacoes/[id]/reprovar error', e)

    // Tratamento bonitinho pra erro de permissão
    if (e instanceof Error && e.message.includes('permissão')) {
      return NextResponse.json(
        { error: e.message },
        { status: 403 },
      )
    }

    return NextResponse.json(
      { error: 'Erro ao reprovar a solicitação.' },
      { status: 500 },
    )
  }
}
