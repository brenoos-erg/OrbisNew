// src/app/api/solicitacoes/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ApprovalStatus, SolicitationStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'

type Meta = {
  requiresApproval?: boolean
}

type TipoSchemaJson = {
  meta?: Meta
}

/** Utilitário simples pra gerar protocolo */
function gerarProtocolo() {
  // Exemplo: RQ-2025-00000123
  const agora = new Date()
  const ano = agora.getFullYear()
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')

  return `RQ-${ano}-${rand}`
}

/**
 * GET /api/solicitacoes
 * Lista solicitações ENVIADAS pelo usuário logado
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const user = await requireActiveUser()

    const page = Number(searchParams.get('page') ?? '1')
    const perPage = Number(searchParams.get('perPage') ?? '10')

    const where = {
      solicitanteId: user.id,
    }

    const [total, itens] = await Promise.all([
      prisma.solicitation.count({ where }),
      prisma.solicitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          tipoSolicitacao: true, // 👈 ajuste pro nome da relação no seu schema
          costCenter: true,
          department: true,
        },
      }),
    ])

    return NextResponse.json({
      page,
      perPage,
      total,
      itens,
    })
  } catch (error) {
    console.error('Erro em GET /api/solicitacoes:', error)
    return NextResponse.json(
      { error: 'Erro ao listar solicitações.' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/solicitacoes  -> cria uma nova solicitação
 */
export async function POST(request: Request) {
  try {
    const user = await requireActiveUser()
    const body = await request.json()

    const {
      centroCustoId,
      departamentoId,
      tipoSolicitacaoId,
      campos,
      solicitante,
    } = body

    if (!centroCustoId || !departamentoId || !tipoSolicitacaoId) {
      return NextResponse.json(
        {
          error:
            'tipoSolicitacaoId, centroCustoId e departamentoId são obrigatórios.',
        },
        { status: 400 },
      )
    }

    // 🔎 Busca o tipo pra ver meta.requiresApproval (se você estiver usando)
    const tipo = await prisma.tipoSolicitacao.findUnique({
      where: { id: tipoSolicitacaoId },
    })

    const schema = tipo?.schemaJson as TipoSchemaJson | null
    const requiresApproval = schema?.meta?.requiresApproval ?? false

    const status = requiresApproval
      ? SolicitationStatus.AGUARDANDO_APROVACAO
      : SolicitationStatus.ABERTA

    const approvalStatus = requiresApproval
      ? ApprovalStatus.PENDENTE
      : ApprovalStatus.NAO_PRECISA

    const protocolo = gerarProtocolo()

    const solicitacao = await prisma.solicitation.create({
      data: {
        protocolo,
        costCenterId: centroCustoId,
        departmentId: departamentoId,

        // 👇 AQUI É O NOME IMPORTANTE!
        // use *exatamente* o que está no seu schema, provavelmente:
        tipoSolicitacaoId, // ✅ se no Prisma é tipoSolicitacaoId
        // tipoId: tipoSolicitacaoId, // ❌ isso dá erro se no Prisma não existe "tipoId"

        solicitanteId: user.id,
        requiresApproval,
        approvalStatus,
        status,
        payload: campos,
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
