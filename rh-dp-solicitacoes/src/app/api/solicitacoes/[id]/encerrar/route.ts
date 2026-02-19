export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { isSolicitacaoExamesSst } from '@/lib/solicitationTypes'

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const { id } = await params

    const solicitation = await prisma.solicitation.findUnique({
      where: { id },
      include: { tipo: true, department: true },
    })

    if (!solicitation || !isSolicitacaoExamesSst(solicitation.tipo)) {
      return NextResponse.json({ error: 'Solicitação RQ.092 não encontrada.' }, { status: 404 })
    }

    const isSst =
      solicitation.department?.code === '19' ||
      me.department?.code === '19' ||
      me.role === 'ADMIN'

    if (!isSst) {
      return NextResponse.json({ error: 'Sem permissão para encerrar este chamado.' }, { status: 403 })
    }

    const updated = await prisma.solicitation.update({
      where: { id },
      data: {
        status: 'CONCLUIDA',
        dataFechamento: new Date(),
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId: id,
        status: 'ENCERRADA',
        message: 'Chamado RQ.092 encerrado pelo SST.',
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/solicitacoes/[id]/encerrar error', error)
    return NextResponse.json({ error: 'Erro ao encerrar solicitação.' }, { status: 500 })
  }
}