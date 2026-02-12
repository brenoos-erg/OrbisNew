export const dynamic = 'force-dynamic'
export const revalidate = 0

// src/app/api/solicitacoes/[id]/assumir/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import crypto from 'crypto'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const { id: solicitationId } = await params

    const solic = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
    })


    if (!solic) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    if (solic.status === 'CONCLUIDA' || solic.status === 'CANCELADA') {
      return NextResponse.json(
        { error: 'Solicitação já foi finalizada.' },
        { status: 400 },
      )
    }

    const updated = await prisma.solicitation.update({
      where: { id: solicitationId },
      data: {
        // 👇 responsável pelo atendimento
        assumidaPorId: me.id,
        assumidaEm: new Date(),
        status: 'EM_ATENDIMENTO',
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

    return NextResponse.json(updated)
  } catch (e) {
    console.error('❌ POST /api/solicitacoes/[id]/assumir error:', e)
    return NextResponse.json(
      { error: 'Erro ao assumir a solicitação.' },
      { status: 500 },
    )
  }
}
