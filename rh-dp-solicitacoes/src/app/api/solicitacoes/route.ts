// src/app/api/solicitacoes/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ApprovalStatus, SolicitationStatus } from '@prisma/client'

// Só pra ter um protocolo amigável. Pode trocar depois.
function gerarProtocolo() {
  const agora = new Date()
  const ano = agora.getFullYear().toString().slice(-2)
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  const hora = String(agora.getHours()).padStart(2, '0')
  const min = String(agora.getMinutes()).padStart(2, '0')
  const seg = String(agora.getSeconds()).padStart(2, '0')

  return `RQ${ano}${mes}${dia}-${hora}${min}${seg}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      tipoId,
      costCenterId,
      departmentId,
      solicitanteId,
      payload,
    } = body

    // validação básica
    if (!tipoId || !costCenterId || !departmentId || !solicitanteId) {
      return NextResponse.json(
        {
          error:
            'tipoId, costCenterId, departmentId e solicitanteId são obrigatórios.',
        },
        { status: 400 },
      )
    }

    // busca o tipo pra usar nome/descrição como título
    const tipo = await prisma.tipoSolicitacao.findUnique({
      where: { id: tipoId },
    })

    if (!tipo) {
      return NextResponse.json(
        { error: 'Tipo de solicitação não encontrado.' },
        { status: 400 },
      )
    }

    const protocolo = gerarProtocolo()

    const solicitacao = await prisma.solicitation.create({
      data: {
        protocolo,
        tipoId,
        costCenterId,
        departmentId,
        solicitanteId,

        // por enquanto tudo sem aprovação
        requiresApproval: false,
        approverId: null,
        approvalStatus: ApprovalStatus.NAO_PRECISA,
        status: SolicitationStatus.ABERTA,

        // título/descrição padrão
        titulo: tipo.nome,
        descricao: tipo.descricao ?? null,

        // joga tudo do formulário dinâmico + card da direita aqui
        payload: payload ?? {},
      },
    })

    return NextResponse.json(solicitacao, { status: 201 })
  } catch (error) {
    console.error('Erro em POST /api/solicitacoes:', error)
    return NextResponse.json(
      { error: 'Erro ao registrar a solicitação.' },
      { status: 500 },
    )
  }
}
