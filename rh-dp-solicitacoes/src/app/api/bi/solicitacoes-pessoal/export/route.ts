import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isBiRequestAuthorized } from '@/lib/bi-auth'
import {
  BI_SOLICITACAO_PESSOAL_COLUMNS,
  buildBiSolicitacaoPessoalWhere,
  collectPayloadCostCenterIds,
  mapSolicitacaoPessoalBiRow,
  toBiSolicitacaoPessoalModelColumns,
} from '@/lib/bi/solicitacoesPessoal'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function escapeCsvValue(value: string) {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
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

    const payloadCostCenterIds = collectPayloadCostCenterIds(items)
    const payloadCostCenters = payloadCostCenterIds.length
      ? await prisma.costCenter.findMany({
          where: { id: { in: payloadCostCenterIds } },
          select: { id: true, description: true, externalCode: true, code: true },
        })
      : []
    const payloadCostCentersById = new Map(
      payloadCostCenters.map((costCenter) => [costCenter.id, costCenter] as const),
    )

    const modelRows = items
      .map((item) => mapSolicitacaoPessoalBiRow(item, payloadCostCentersById))
      .map((row) => toBiSolicitacaoPessoalModelColumns(row))

    const header = BI_SOLICITACAO_PESSOAL_COLUMNS.join(';')
    const body = modelRows
      .map((row) => BI_SOLICITACAO_PESSOAL_COLUMNS.map((column) => escapeCsvValue(String(row[column] ?? ''))).join(';'))
      .join('\n')

    const csv = `${header}\n${body}`
    const fileDate = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bi-solicitacoes-pessoal-${fileDate}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/bi/solicitacoes-pessoal/export', error)
    return NextResponse.json(
      { error: 'Erro ao gerar exportação CSV de solicitações de pessoal.' },
      { status: 500 },
    )
  }
}