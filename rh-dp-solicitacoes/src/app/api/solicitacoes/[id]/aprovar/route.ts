// src/app/api/solicitacoes/[id]/aprovar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { requireActiveUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/solicitacoes/[id]/aprovar
 * Aprova uma solicitação pendente (Vidal/Lorena) e a coloca como
 * "Aguardando atendimento" para o setor responsável.
 *
 * body opcional: { comment?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const me = await requireActiveUser()
    const solicitationId = params.id

    const body = await req.json().catch(() => ({}))
    const comment: string | undefined = body.comment

    const solicitation = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
    })

    if (!solicitation) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    if (
      !solicitation.requiresApproval ||
      solicitation.approvalStatus !== 'PENDENTE'
    ) {
      return NextResponse.json(
        { error: 'Solicitação não está pendente de aprovação.' },
        { status: 400 },
      )
    }

    // Se tiver aprovador definido, só ele pode aprovar
    if (solicitation.approverId && solicitation.approverId !== me.id) {
      return NextResponse.json(
        { error: 'Você não é o aprovador desta solicitação.' },
        { status: 403 },
      )
    }

    const updated = await prisma.solicitation.update({
      where: { id: solicitationId },
      data: {
        approvalStatus: 'APROVADO',
        approvalAt: new Date(),
        approvalComment: comment ?? null,
        requiresApproval: false,

        // 🔹 Depois de aprovada fica "aguardando atendimento"
        // (na prática: ABERTA para o setor responsável tratar)
        status: 'ABERTA',

        // 🔹 Não fica mais atrelada ao Vidal/Lorena como atendente
        approverId: null,
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId,
        status: 'APROVADO',
        message:
          comment && comment.trim().length > 0
            ? `Aprovado por ${me.fullName ?? me.id}: ${comment}`
            : `Aprovado por ${me.fullName ?? me.id}`,
      },
    })

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
    console.error('❌ POST /api/solicitacoes/[id]/aprovar error:', e)
    return NextResponse.json(
      { error: 'Erro ao aprovar a solicitação.' },
      { status: 500 },
    )
  }
}
