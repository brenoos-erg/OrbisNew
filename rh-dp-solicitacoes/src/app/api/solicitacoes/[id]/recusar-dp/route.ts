export const dynamic = 'force-dynamic'
export const revalidate = 0

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { isSolicitacaoAgendamentoFerias } from '@/lib/solicitationTypes'
import { isViewerOnlyForSolicitation } from '@/lib/solicitationPermissionGuards'
import { notifySolicitationEvent } from '@/lib/solicitationOperationalNotifications'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const motivo = String(body?.motivo ?? '').trim()

    if (!motivo) {
      return NextResponse.json({ error: 'Informe o motivo da recusa.' }, { status: 400 })
    }

    const isViewerOnly = await isViewerOnlyForSolicitation({ solicitationId: id, userId: me.id })
    if (isViewerOnly) {
      return NextResponse.json({ error: 'Usuário visualizador não pode executar esta ação.' }, { status: 403 })
    }

    const solicitation = await prisma.solicitation.findUnique({
      where: { id },
      include: {
        tipo: true,
        department: { select: { code: true } },
      },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (!isSolicitacaoAgendamentoFerias(solicitation.tipo)) {
      return NextResponse.json({ error: 'Recusa do DP disponível apenas para Solicitação de Férias.' }, { status: 400 })
    }

    if (solicitation.department?.code !== '08') {
      return NextResponse.json({ error: 'A solicitação ainda não está na etapa do Departamento Pessoal.' }, { status: 409 })
    }

    if (solicitation.status === 'CONCLUIDA' || solicitation.status === 'CANCELADA') {
      return NextResponse.json({ error: 'Solicitação já encerrada.' }, { status: 400 })
    }

    const isDpUser = me.role === 'ADMIN' || me.department?.code === '08'

    if (!isDpUser) {
      return NextResponse.json({ error: 'Somente usuários do Departamento Pessoal podem recusar esta solicitação.' }, { status: 403 })
    }

    const now = new Date()
    const updated = await prisma.solicitation.update({
      where: { id },
      data: {
        status: 'CANCELADA',
        approvalStatus: 'REPROVADO',
        approvalComment: motivo,
        approvalAt: now,
        approverId: me.id,
        dataFechamento: now,
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId: id,
        status: 'REJEITADA_DP',
        message: `Solicitação recusada pelo Departamento Pessoal. Motivo: ${motivo}`,
      },
    })

    await prisma.event.create({
      data: {
        id: randomUUID(),
        solicitationId: id,
        actorId: me.id,
        tipo: 'RECUSA_DP',
      },
    })

    await notifySolicitationEvent({
      solicitationId: id,
      event: 'REJECTED',
      actorName: me.fullName ?? me.id,
      reason: motivo,
      dedupeKey: `REJECTED_DP:${id}`,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/solicitacoes/[id]/recusar-dp error', error)
    return NextResponse.json({ error: 'Erro ao recusar solicitação no Departamento Pessoal.' }, { status: 500 })
  }
}