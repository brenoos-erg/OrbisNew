export const dynamic = 'force-dynamic'
export const revalidate = 0

import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const { id } = await params

    const solicitation = await prisma.solicitation.findUnique({
      where: { id },
      include: {
        tipo: {
          select: {
            schemaJson: true,
          },
        },
      },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (solicitation.status === 'CONCLUIDA' || solicitation.status === 'CANCELADA') {
      return NextResponse.json({ error: 'Solicitação já encerrada.' }, { status: 400 })
    }

    const departamentos = Array.isArray((solicitation.tipo?.schemaJson as any)?.meta?.departamentos)
      ? ((solicitation.tipo?.schemaJson as any).meta.departamentos as unknown[])
          .filter((item): item is string => typeof item === 'string')
      : []

    const departamentoFinal = departamentos.length > 0 ? departamentos[departamentos.length - 1] : null
    const isUltimaEtapa =
      departamentos.length <= 1 ||
      (departamentoFinal !== null && solicitation.departmentId === departamentoFinal)

    if (!isUltimaEtapa) {
      return NextResponse.json(
        { error: 'Só é possível finalizar chamados na última etapa do fluxo.' },
        { status: 400 },
      )
    }

    const isResponsavelEtapa =
      me.role === 'ADMIN' ||
      me.departmentId === solicitation.departmentId

    if (!isResponsavelEtapa) {
      return NextResponse.json(
        { error: 'Você não pode finalizar solicitações deste departamento.' },
        { status: 403 },
      )
    }

    const now = new Date()

    const updated = await prisma.solicitation.update({
      where: { id },
      data: {
        status: 'CONCLUIDA',
        dataFechamento: now,
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId: id,
        status: 'CONCLUIDA',
        message: 'Solicitação finalizada na última etapa do fluxo.',
      },
    })

    await prisma.event.create({
      data: {
        id: randomUUID(),
        solicitationId: id,
        actorId: me.id,
        tipo: 'FINALIZADA',
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/solicitacoes/[id]/finalizar error', error)
    return NextResponse.json({ error: 'Erro ao finalizar solicitação.' }, { status: 500 })
  }
}