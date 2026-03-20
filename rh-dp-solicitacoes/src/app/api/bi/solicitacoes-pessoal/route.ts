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
  },
)