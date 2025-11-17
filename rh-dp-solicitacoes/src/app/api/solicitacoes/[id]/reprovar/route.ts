import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const solicitationId = params.id
    const body = await req.json().catch(() => ({}))

    const userId = body.userId as string | undefined
    const comment =
      (body.comment as string | undefined) ??
      (body.comentario as string | undefined) ??
      null

    if (!userId) {
      return NextResponse.json(
        { error: 'Usuário não informado.' },
        { status: 400 },
      )
    }

    const solicit = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
    })

    if (!solicit) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    if (solicit.approvalStatus !== 'PENDENTE') {
      return NextResponse.json(
        { error: 'Solicitação não está pendente de aprovação.' },
        { status: 400 },
      )
    }

    const updated = await prisma.solicitation.update({
      where: { id: solicitationId },
      data: {
        approvalStatus: 'REPROVADO',
        approvalAt: new Date(),
        approvalComment: comment,
        status: 'CANCELADA',
      },
    })

    // Evento na "linha do tempo"
    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        actorId: userId,
        tipo: 'REPROVACAO',
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('PATCH /api/solicitacoes/[id]/reprovar error', err)
    return NextResponse.json(
      { error: 'Erro interno ao reprovar solicitação.' },
      { status: 500 },
    )
  }
}
