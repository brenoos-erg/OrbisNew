// src/app/api/solicitacoes/[id]/aprovar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(
req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const me = await requireActiveUser()
    const solicitationId = params.id
    const body = (await req.json().catch(() => ({}))) as {
      comment?: string
    }
    const approvalComment = body.comment?.trim()


    const solic = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
    })

    if (!solic) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    if (solic.approvalStatus !== 'PENDENTE') {
      return NextResponse.json(
        { error: 'Esta solicitação não está pendente de aprovação.' },
        { status: 400 },
      )
    }

    const updated = await prisma.solicitation.update({
  where: { id: solicitationId },
      data: {
        approvalStatus: 'APROVADO',
        approvalAt: new Date(),
        approverId: me.id,
        approvalComment: approvalComment ?? null,
        // Depois de aprovado, volta para ABERTA,
        // e o front interpreta como "Aguardando atendimento"
        status: 'ABERTA',
      },
    })


    await prisma.solicitationTimeline.create({
      data: {
        solicitationId,
        status: 'AGUARDANDO_ATENDIMENTO',
        message:
          approvalComment && approvalComment.length > 0
            ? approvalComment
            : `Solicitação aprovada por ${me.fullName ?? me.id}.`,
      },
    })

    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        actorId: me.id,
        tipo: 'APROVACAO_GESTOR',
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
