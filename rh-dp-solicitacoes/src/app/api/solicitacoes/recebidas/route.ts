export const dynamic = 'force-dynamic'
export const revalidate = 0

// rh-dp-solicitacoes/src/app/api/solicitacoes/recebidas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { formatCostCenterLabel } from '@/lib/costCenter'
import {
  buildListAndCountArgs,
} from '@/lib/receivedSolicitationsQuery'
import {
  applyInMemorySearchFilter,
  applyResponsibleTextFilter,
  buildBaseWhereFromFilters,
  buildPaginationFromFilters,
  buildSortFromFilters,
  parseSolicitationListFilters,
} from '@/lib/solicitationListFilters'
import { searchSolicitationIdsByText } from '@/lib/solicitationSearchIndex'
import { resolvePrimaryResponsibleForList } from '@/lib/solicitationResponsibility'
import {
  buildReceivedWhereByPolicy,
  resolveUserAccessContext,
} from '@/lib/solicitationAccessPolicy'

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const { searchParams } = new URL(req.url)
    const filters = parseSolicitationListFilters(searchParams)
    // Compatibilidade histórica: getAdvancedTextFilters(searchParams) foi consolidado no parser compartilhado.
    const { page, pageSize, skip } = buildPaginationFromFilters(filters)
    const userAccess = await resolveUserAccessContext({
      userId: me.id,
      userLogin: me.login,
      userEmail: me.email,
      userFullName: me.fullName,
      role: me.role,
      primaryDepartmentId: me.departmentId,
      primaryDepartment: me.department,
    })
    const dbWhere = buildReceivedWhereByPolicy(
      userAccess,
      buildBaseWhereFromFilters(filters),
      { excludePendingRq063: true },
    )

    const protocolLike = filters.q ? /^RQ\d{4,8}-\d{3,}$/.test(filters.q.trim().toUpperCase()) : false
    const searchDiagnostics: Array<{ code: string; message: string }> = []
    if (filters.q) {
      const searchIds = protocolLike
        ? (await prisma.solicitation.findMany({ where: { AND: [dbWhere, { protocolo: filters.q.trim() }] }, select: { id: true } })).map((row) => row.id)
        : await searchSolicitationIdsByText(filters.q, dbWhere, 10000)
      if (searchIds.length > 0) {
        dbWhere.id = { in: searchIds }
      } else if (protocolLike) {
        dbWhere.id = { in: [] }
        searchDiagnostics.push({ code: 'PROTOCOL_NOT_IN_SCOPE', message: 'O protocolo não existe, não está visível para seu usuário ou foi removido pelos filtros aplicados.' })
      } else {
        searchDiagnostics.push({ code: 'SEARCH_INDEX_EMPTY_FALLBACK', message: 'Índice de busca vazio ou sem resultado; usando fallback textual em memória após filtros de permissão.' })
      }
    }

    const hasInMemoryFilters = Boolean((filters.q && !protocolLike && !('id' in dbWhere)) || filters.responsibleText)
    const orderBy = buildSortFromFilters(filters)
    const { findManyArgs, countArgs } = buildListAndCountArgs(dbWhere, {
      skip,
      pageSize,
      orderBy,
      includeGlobalSearchData: hasInMemoryFilters,
    })

    const inMemorySearchWindow = 2000
    if (hasInMemoryFilters) {
      findManyArgs.take = inMemorySearchWindow
    }

    const [allSolicitations, dbTotal] = await Promise.all([
      prisma.solicitation.findMany(findManyArgs),
      hasInMemoryFilters ? Promise.resolve(0) : prisma.solicitation.count(countArgs),
    ])

    const filteredSolicitations = hasInMemoryFilters
      ? applyResponsibleTextFilter(
          applyInMemorySearchFilter(allSolicitations, filters.q),
          filters.responsibleText,
        )
      : allSolicitations
    const total = hasInMemoryFilters ? filteredSolicitations.length : dbTotal
    const paginatedSolicitations = hasInMemoryFilters
      ? filteredSolicitations.slice(skip, skip + pageSize)
      : filteredSolicitations
    const diagnostics = [
      ...searchDiagnostics,
      ...(hasInMemoryFilters && allSolicitations.length >= inMemorySearchWindow
        ? [{ code: 'SEARCH_WINDOW_TRUNCATED', message: 'A busca textual em fallback foi limitada aos primeiros 2000 chamados já visíveis/filtrados. Recrie o índice para cobertura completa.' }]
        : []),
    ]

    const rows = paginatedSolicitations.map((s) => {
      const responsible = resolvePrimaryResponsibleForList({
        tipo: s.tipo,
        assumidaPor: s.assumidaPor,
        assumidaPorId: s.assumidaPorId,
        approver: s.approver,
        approverId: s.approverId,
        status: s.status,
        payload: s.payload,
      })
      return ({
      id: s.id,
      titulo: s.titulo,
      status: s.status,
      protocolo: s.protocolo,
      createdAt: s.dataAbertura ? s.dataAbertura.toISOString() : null,
      tipo: s.tipo ? { id: s.tipo.id, codigo: s.tipo.codigo, nome: s.tipo.nome } : null,
      responsavelId: responsible.responsavelId,
      responsavel: responsible.responsavel,
      autor: s.solicitante ? { fullName: s.solicitante.fullName } : null,
      sla: null,
      setorDestino:
        formatCostCenterLabel(s.costCenter, '') || (s.department?.name ?? null),
      requiresApproval: s.requiresApproval,
      approvalStatus: s.approvalStatus,
      approverId: s.approverId ?? null,
      departmentId: s.departmentId ?? null,
      costCenterId: s.costCenterId ?? null,
    })
    })

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      filtersApplied: filters,
      diagnostics,
    })
  } catch (err) {
    console.error('GET /api/solicitacoes/recebidas error', err)
    if (err instanceof Error && err.message === 'Usuário não autenticado') {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'Usuário inativo') {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2021' &&
      err.meta?.table === 'public.SolicitacaoSetor'
    ) {
      return NextResponse.json(
        {
          error:
            'Erro de configuração: tabela SolicitacaoSetor ausente. Execute as migrations do Prisma.',
        },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: 'Erro ao buscar solicitações recebidas.' },
      { status: 500 },
    )
  }
}
