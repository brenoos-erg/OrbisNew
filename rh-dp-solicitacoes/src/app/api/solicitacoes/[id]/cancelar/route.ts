export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { notifySolicitationEvent } from '@/lib/solicitationOperationalNotifications'
import { randomUUID } from 'crypto'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const { id } = await params

    if (me.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Somente administradores podem cancelar solicitações.' },
        { status: 403 },
      )
    }

    const body = await req.json().catch(() => ({} as { motivo?: string }))
    const motivo = (body?.motivo ?? '').trim()

    if (!motivo) {
      return NextResponse.json(
        { error: 'Informe o motivo do cancelamento.' },
        { status: 400 },
      )
    }

    const solicitation = await prisma.solicitation.findUnique({ where: { id } })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (solicitation.status === 'CONCLUIDA' || solicitation.status === 'CANCELADA') {
      return NextResponse.json(
        { error: 'Solicitação já finalizada ou cancelada.' },
        { status: 400 },
      )
    }

    const agora = new Date()

    const updated = await prisma.solicitation.update({
      where: { id },
      data: {
        status: 'CANCELADA',
        dataCancelamento: agora,
        approvalStatus: 'REPROVADO',
        approvalAt: agora,
        approvalComment: motivo,
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId: id,
        status: 'CANCELADA',
        message: `Solicitação cancelada pelo administrador ${me.fullName ?? me.id}: ${motivo}`,
      },
    })

   
    await prisma.event.create({
      data: {
        id: randomUUID(),
        solicitationId: id,
        actorId: me.id,
        tipo: 'REPROVACAO',
      },
    })

    await notifySolicitationEvent({
      solicitationId: id,
      event: 'CANCELED',
      actorName: me.fullName ?? me.id,
      reason: motivo,
      dedupeKey: `CANCELED:${id}` ,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/solicitacoes/[id]/cancelar error', error)
    return NextResponse.json(
      { error: 'Erro ao cancelar solicitação.' },
      { status: 500 },
    )
  }
}
