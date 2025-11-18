// src/app/api/solicitacoes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { requireActiveUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/solicitacoes/[id]
 * Retorna os detalhes completos de uma solicitação específica.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const item = await prisma.solicitation.findUnique({
      where: { id: params.id },
      include: {
        tipo: true,
        comentarios: {
          include: {
            autor: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        anexos: true,
        eventos: {
          orderBy: { createdAt: 'asc' },
        },
        timelines: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    return NextResponse.json(item)
  } catch (e) {
    console.error('❌ GET /api/solicitacoes/[id] error:', e)
    return NextResponse.json(
      { error: 'Erro interno ao buscar solicitação.' },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/solicitacoes/[id]
 *
 * Neste momento vamos usar o PATCH especificamente para
 * **REPROVAR** a solicitação a partir do painel de aprovação.
 *
 * body: { comment: string }
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireActiveUser() // usuário logado
    const solicitationId = params.id

    const body = await req.json().catch(() => ({}))
    const comment: string | undefined = body.comment

    if (!comment || !comment.trim()) {
      return NextResponse.json(
        { error: 'Motivo é obrigatório.' },
        { status: 400 },
      )
    }

    // 1) Buscar solicitação
    const solicitation = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
    })

    if (!solicitation) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    // Só aprova/reprova se estiver pendente de aprovação
    if (!solicitation.requiresApproval || solicitation.approvalStatus !== 'PENDENTE') {
      return NextResponse.json(
        { error: 'Solicitação não está pendente de aprovação.' },
        { status: 400 },
      )
    }

    // Se tiver aprovador definido, só ele pode reprovar
    if (solicitation.approverId && solicitation.approverId !== me.id) {
      return NextResponse.json(
        { error: 'Você não é o aprovador desta solicitação.' },
        { status: 403 },
      )
    }

    // 2) Atualizar como REPROVADO / CANCELADA
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

    // 3) Timeline
    await prisma.solicitationTimeline.create({
      data: {
        solicitationId,
        status: 'REPROVADO',
        message: `Reprovado por ${me.fullName ?? me.id}: ${comment}`,
      },
    })

    // 4) Evento
    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        actorId: me.id,
        tipo: 'REPROVACAO',
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('❌ PATCH /api/solicitacoes/[id] (reprovar) error:', e)
    return NextResponse.json(
      { error: 'Erro ao reprovar a solicitação.' },
      { status: 500 },
    )
  }
}
