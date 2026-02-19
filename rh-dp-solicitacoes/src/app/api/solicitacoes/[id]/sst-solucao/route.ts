export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { isSolicitacaoExamesSst } from '@/lib/solicitationTypes'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const { id } = await params
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }

    const { tipoRespostaSst, descricaoSolucaoSst, observacaoSst1, observacaoSst2, prazoProrrogado, finalizar } =
      body as Record<string, any>

    const solicitation = await prisma.solicitation.findUnique({
      where: { id },
      include: { tipo: true, department: true },
    })

    if (!solicitation || !isSolicitacaoExamesSst(solicitation.tipo)) {
      return NextResponse.json({ error: 'Solicitação RQ.092 não encontrada.' }, { status: 404 })
    }

    const isSst = solicitation.department?.code === '19' || me.department?.code === '19' || me.role === 'ADMIN'
    if (!isSst) {
      return NextResponse.json({ error: 'Sem permissão para tratar este chamado.' }, { status: 403 })
    }

    const payloadAtual = (solicitation.payload ?? {}) as Record<string, any>
    const sstAtual = (payloadAtual.sst ?? {}) as Record<string, any>
    const prazoFinal = prazoProrrogado ? new Date(`${prazoProrrogado}T23:59:59`) : null

    const updated = await prisma.solicitation.update({
      where: { id },
      data: {
        status: finalizar ? 'CONCLUIDA' : solicitation.status,
        dataFechamento: finalizar ? new Date() : solicitation.dataFechamento,
        dataPrevista: prazoFinal ?? solicitation.dataPrevista,
        payload: {
          ...payloadAtual,
          sst: {
            ...sstAtual,
            tipoRespostaSst: tipoRespostaSst ?? sstAtual.tipoRespostaSst ?? '',
            descricaoSolucaoSst: descricaoSolucaoSst ?? sstAtual.descricaoSolucaoSst ?? '',
            observacaoSst1: observacaoSst1 ?? sstAtual.observacaoSst1 ?? '',
            observacaoSst2: observacaoSst2 ?? sstAtual.observacaoSst2 ?? '',
            prazoProrrogado: prazoProrrogado ?? sstAtual.prazoProrrogado ?? null,
            prazoFinal: (prazoFinal ?? solicitation.dataPrevista)?.toISOString() ?? null,
          },
        },
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId: id,
        status: finalizar ? 'CONCLUIDA' : 'EM_ATENDIMENTO',
        message: finalizar
          ? 'Chamado RQ.092 finalizado pelo SST.'
          : 'Dados de resposta/solução do SST atualizados.',
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST /api/solicitacoes/[id]/sst-solucao error', error)
    return NextResponse.json({ error: 'Erro ao atualizar resposta/solução SST.' }, { status: 500 })
  }
}