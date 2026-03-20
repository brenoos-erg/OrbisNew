import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isBiRequestAuthorized } from '@/lib/bi-auth'
import {
  BI_SOLICITACAO_PESSOAL_COLUMNS,
  buildBiSolicitacaoPessoalWhere,
  mapSolicitacaoPessoalBiRow,
  toBiSolicitacaoPessoalModelColumns,
} from '@/lib/bi/solicitacoesPessoal'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const auth = isBiRequestAuthorized(req)
    if (!auth.ok) {
      return NextResponse.json(
        { error: 'Não autorizado para consumo BI. Informe x-api-key válido.' },
        { status: 401 },
      )
    }

    const { searchParams } = new URL(req.url)

    const where = buildBiSolicitacaoPessoalWhere({
      dateStart: searchParams.get('dateStart'),
      dateEnd: searchParams.get('dateEnd'),
      status: searchParams.get('status'),
      protocolo: searchParams.get('protocolo'),
      departmentId: searchParams.get('departmentId'),
      solicitante: searchParams.get('solicitante'),
    })

    const items = await prisma.solicitation.findMany({
      where,
      orderBy: [{ dataAbertura: 'desc' }],
      select: {
        protocolo: true,
        dataAbertura: true,
        status: true,
        payload: true,
        solicitante: { select: { fullName: true } },
        costCenter: { select: { description: true, externalCode: true, code: true } },
        department: { select: { name: true } },
      },
    })

    const rows = items.map((item) => mapSolicitacaoPessoalBiRow(item))
    const modelRows = rows.map(toBiSolicitacaoPessoalModelColumns)

    return NextResponse.json({
      metadata: {
        fonte: 'Solicitações de pessoal/admissão',
        generatedAt: new Date().toISOString(),
        totalRows: rows.length,
        colunas: BI_SOLICITACAO_PESSOAL_COLUMNS,
        filtrosSuportados: ['dateStart', 'dateEnd', 'status', 'protocolo', 'departmentId', 'solicitante'],
        observacoes: [
          'Uma linha por solicitação.',
          'A coluna ordem é preenchida com campos do payload quando existir (ordem, ordemVaga, ordemServico, numeroOrdem).',
        ],
      },
      rows,
      modelRows,
    })
  } catch (error) {
    console.error('GET /api/bi/solicitacoes-pessoal', error)
    return NextResponse.json(
      { error: 'Erro ao gerar dataset BI de solicitações de pessoal.' },
      { status: 500 },
    )
  }
}