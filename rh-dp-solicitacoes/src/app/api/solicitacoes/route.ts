// src/app/api/solicitacoes/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ApprovalStatus, SolicitationStatus } from '@prisma/client'

type Meta = {
  requiresApproval?: boolean
}

type TipoSchemaJson = {
  meta?: Meta
}

// POST /api/solicitacoes  -> cria uma nova solicitação
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      tipoId,
      costCenterId,
      departmentId,
      solicitanteId,
      titulo,
      descricao,
      payload,
    } = body ?? {}

    if (!tipoId || !costCenterId || !departmentId || !solicitanteId) {
      return NextResponse.json(
        {
          error:
            'tipoId, costCenterId, departmentId e solicitanteId são obrigatórios.',
        },
        { status: 400 },
      )
    }

    // pega o tipo pra ver meta.requiresApproval (se você usar)
    const tipo = await prisma.tipoSolicitacao.findUnique({
      where: { id: tipoId },
    })

    if (!tipo) {
      return NextResponse.json(
        { error: 'Tipo de solicitação não encontrado.' },
        { status: 404 },
      )
    }

    const schema = tipo.schemaJson as TipoSchemaJson | null
    const requiresApproval = schema?.meta?.requiresApproval ?? false

    // gera protocolo simples
    const count = await prisma.solicitation.count()
    const protocolo = `RQ-${String(count + 1).padStart(6, '0')}`

    const status: SolicitationStatus = requiresApproval
      ? SolicitationStatus.AGUARDANDO_APROVACAO
      : SolicitationStatus.ABERTA

    const approvalStatus: ApprovalStatus = requiresApproval
      ? ApprovalStatus.PENDENTE
      : ApprovalStatus.NAO_PRECISA

    const approverId: string | null = null // depois você pode colocar regra aqui

const solicitacao = await prisma.solicitation.create({
  data: {
    protocolo,
    tipoId,
    costCenterId,
    departmentId,
    solicitanteId,
    requiresApproval,
    approverId,
    approvalStatus,
    status,
    titulo,
    descricao,
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
