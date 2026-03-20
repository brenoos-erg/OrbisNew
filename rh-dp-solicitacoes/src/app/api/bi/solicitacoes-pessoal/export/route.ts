import { ModuleLevel } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { withModuleLevel } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import {
  BI_SOLICITACAO_PESSOAL_COLUMNS,
  buildBiSolicitacaoPessoalWhere,
  mapSolicitacaoPessoalBiRow,
  toBiSolicitacaoPessoalModelColumns,
} from '@/lib/bi/solicitacoesPessoal'
import { buildSensitiveHiringVisibilityWhere, getUserDepartmentIds } from '@/lib/sensitiveHiringRequests'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function escapeCsvValue(value: string) {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export const GET = withModuleLevel(
  'solicitacoes',
  ModuleLevel.NIVEL_1,
  async (req: NextRequest, ctx) => {
    try {
      const { searchParams } = new URL(req.url)
      const { me } = ctx

      const where = buildBiSolicitacaoPessoalWhere({
        dateStart: searchParams.get('dateStart'),
        dateEnd: searchParams.get('dateEnd'),
        status: searchParams.get('status'),
        protocolo: searchParams.get('protocolo'),
        departmentId: searchParams.get('departmentId'),
        solicitante: searchParams.get('solicitante'),
      })

      const userDepartmentIdsForSensitive = await getUserDepartmentIds(me.id, me.departmentId)
      const existingAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : []

      where.AND = [
        ...existingAnd,
        buildSensitiveHiringVisibilityWhere({
          userId: me.id,
          role: me.role,
          departmentIds: userDepartmentIdsForSensitive,
        }),
      ]

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
        },
      })

      const modelRows = items
        .map((item) => mapSolicitacaoPessoalBiRow(item))
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
  },
)