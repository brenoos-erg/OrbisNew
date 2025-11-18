// src/app/api/solicitacoes/[id]/assumir/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/solicitacoes/[id]/assumir
 * Marca o chamado como "assumido" pelo usuário logado
 * e muda o status para EM_ATENDIMENTO.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const me = await requireActiveUser()
    const solicitationId = params.id

    const solic = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
    })

    if (!solic) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    // Se já está concluída/cancelada, não deixa assumir
    if (solic.status === 'CONCLUIDA' || solic.status === 'CANCELADA') {
      return NextResponse.json(
        { error: 'Solicitação já foi finalizada.' },
        { status: 400 },
      )
    }

    const updated = await prisma.solicitation.update({
      where: { id: solicitationId },
      data: {
        approverId: me.id,          // atendente
        status: 'EM_ATENDIMENTO',   // entra na barra verde "EM ATENDIMENTO"
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId,
        status: 'EM_ATENDIMENTO',
        message: `Chamado assumido por ${me.fullName ?? me.id}.`,
      },
    })

    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        actorId: me.id,
        tipo: 'ASSUMIU_CHAMADO',
      },
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (e) {
    console.error('❌ POST /api/solicitacoes/[id]/assumir error:', e)
    return NextResponse.json(
      { error: 'Erro ao assumir a solicitação.' },
      { status: 500 },
    )
  }
}
