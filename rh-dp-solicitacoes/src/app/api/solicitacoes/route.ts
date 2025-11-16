// src/app/api/solicitacoes/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ApprovalStatus, SolicitationStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/guards'

/* ------------------------------------------
   GERADOR DE PROTOCOLO
------------------------------------------- */
function gerarProtocolo() {
  const d = new Date()
  const ano = d.getFullYear().toString().slice(-2)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `RQ${ano}${mes}${dia}-${h}${m}${s}`
}

/* ------------------------------------------
   GET → Lista solicitações enviadas pelo usuário
------------------------------------------- */
export async function GET(request: Request) {
  try {
    const g = await requireActiveUser()
    if (!g.ok) return g.response
    const user = g.user

    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page') ?? '1')
    const perPage =
      Number(searchParams.get('pageSize') ?? searchParams.get('perPage') ?? '10')

    const where = { solicitanteId: user.id }

    const [total, registros] = await Promise.all([
      prisma.solicitation.count({ where }),
      prisma.solicitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          tipo: true,
          costCenter: true,
        },
      }),
    ])

    // Formato que a sua tabela do frontend espera:
    const rows = registros.map((s) => ({
      id: s.id,
      titulo: s.tipo?.nome ?? '',
      status: s.status,
      protocolo: s.protocolo ?? undefined,
      createdAt: s.createdAt.toISOString(),
      tipo: s.tipo ? { nome: s.tipo.nome } : null,
      responsavel: null,
      responsavelId: null,
      autor: null,
      sla: null,
      setorDestino: s.costCenter?.description ?? null,
    }))

    return NextResponse.json({ rows, total })
  } catch (error) {
    console.error('Erro em GET /api/solicitacoes:', error)
    return NextResponse.json(
      { error: 'Erro ao listar solicitações.' },
      { status: 500 },
    )
  }
}

/* ------------------------------------------
   POST → Cria nova solicitação
------------------------------------------- */
export async function POST(request: Request) {
  try {
    const g = await requireActiveUser()
    if (!g.ok) return g.response
    const user = g.user

    const body = await request.json()

    const {
      tipoId,
      costCenterId,
      departmentId,
      payload,
    } = body

    if (!tipoId || !costCenterId || !departmentId) {
      return NextResponse.json(
        { error: 'tipoId, costCenterId e departmentId são obrigatórios.' },
        { status: 400 },
      )
    }

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
        solicitanteId: user.id,

        requiresApproval: false,
        approverId: null,
        approvalStatus: ApprovalStatus.NAO_PRECISA,
        status: SolicitationStatus.ABERTA,

        titulo: tipo.nome,
        descricao: tipo.descricao ?? null,

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
