// src/app/api/solicitacoes/[id]/aprovar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

type RouteParams = {
  params: { id: string }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const me = await requireActiveUser() // 👈 pega o usuário logado
    const { id: solicitationId } = params

    // corpo opcional, só pra receber comentário se você quiser
    const body = await req.json().catch(() => ({}))
    const comment: string | undefined = body.comment

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

    // 2) Valida estado de aprovação
    if (!solicit.requiresApproval || solicit.approvalStatus !== 'PENDENTE') {
      return NextResponse.json(
        { error: 'Solicitação não está pendente de aprovação.' },
        { status: 400 },
      )
    }

    // Se tiver um aprovador definido, só ele pode aprovar
    if (solicit.approverId && solicit.approverId !== me.id) {
      return NextResponse.json(
        { error: 'Você não é o aprovador desta solicitação.' },
        { status: 403 },
      )
    }

    // 3) Atualiza como APROVADO
    const updated = await prisma.solicitation.update({
      where: { id: solicitationId },
      data: {
        approvalStatus: 'APROVADO',
        approvalAt: new Date(),
        approvalComment: comment ?? null,
        requiresApproval: false,
        status: 'EM_ATENDIMENTO', // RH já pode seguir
      },
    })

    // 4) Registra evento
    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        actorId: me.id,
        tipo: 'APROVACAO',
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('POST /api/solicitacoes/[id]/aprovar error', e)
    return NextResponse.json(
      { error: 'Erro ao aprovar a solicitação.' },
      { status: 500 },
    )
  }
}
