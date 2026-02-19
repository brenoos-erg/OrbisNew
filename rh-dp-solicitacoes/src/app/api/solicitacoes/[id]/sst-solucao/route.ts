export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { isSolicitacaoExamesSst } from '@/lib/solicitationTypes'

export async function PATCH(
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

    const { tipoResposta, descricaoSolucao, observacao1, observacao2, finalizar } =
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
    const sstRespostaAtual = (payloadAtual.sstResposta ?? {}) as Record<string, any>

    const updated = await prisma.solicitation.update({
      where: { id },
      data: {
        status: finalizar ? 'CONCLUIDA' : solicitation.status,
        dataFechamento: finalizar ? new Date() : solicitation.dataFechamento,
         payload: {
          ...payloadAtual,
          sstResposta: {
            ...sstRespostaAtual,
            tipoResposta: tipoResposta ?? sstRespostaAtual.tipoResposta ?? '',
            descricaoSolucao: descricaoSolucao ?? sstRespostaAtual.descricaoSolucao ?? '',
            observacao1: observacao1 ?? sstRespostaAtual.observacao1 ?? '',
            observacao2: observacao2 ?? sstRespostaAtual.observacao2 ?? '',
            respondedAt: new Date().toISOString(),
            respondedBy: me.id,
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
    console.error('PATCH /api/solicitacoes/[id]/sst-solucao error', error)
    return NextResponse.json({ error: 'Erro ao atualizar resposta/solução SST.' }, { status: 500 })
  }
}