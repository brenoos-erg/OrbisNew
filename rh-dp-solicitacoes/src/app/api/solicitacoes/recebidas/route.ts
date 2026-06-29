export const dynamic = 'force-dynamic'
export const revalidate = 0

// rh-dp-solicitacoes/src/app/api/solicitacoes/recebidas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { formatCostCenterLabel } from '@/lib/costCenter'
import {
  applyReceivedInMemoryFilters,
  buildListAndCountArgs,
  buildWhereFromSearchParams,
  getAdvancedTextFilters,
  hasReceivedInMemoryFilters,
} from '@/lib/receivedSolicitationsQuery'
import { resolvePrimaryResponsibleForList } from '@/lib/solicitationResponsibility'
import {
  buildReceivedWhereByPolicy,
  resolveUserAccessContext,
} from '@/lib/solicitationAccessPolicy'

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const { searchParams } = new URL(req.url)
    const page = Math.max(
      1,
      Number.parseInt(searchParams.get('page') ?? '1', 10) || 1,
    )
    const pageSize =
      Number.parseInt(searchParams.get('pageSize') ?? '10', 10) || 10

    const skip = (page - 1) * pageSize
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
      buildWhereFromSearchParams(searchParams),
      { excludePendingRq063: true },
    )

    const advancedTextFilters = getAdvancedTextFilters(searchParams)
    const hasInMemoryFilters = hasReceivedInMemoryFilters(advancedTextFilters)
    const { findManyArgs, countArgs } = buildListAndCountArgs(dbWhere, {
      skip,
      pageSize,
      orderBy: [{ dataAbertura: 'desc' }],
      includeGlobalSearchData: hasInMemoryFilters,
    })

    const [allSolicitations, dbTotal] = await Promise.all([
      prisma.solicitation.findMany(findManyArgs),
      hasInMemoryFilters ? Promise.resolve(0) : prisma.solicitation.count(countArgs),
    ])

    const filteredSolicitations = hasInMemoryFilters
      ? applyReceivedInMemoryFilters(allSolicitations, advancedTextFilters)
      : allSolicitations
    const total = hasInMemoryFilters ? filteredSolicitations.length : dbTotal
    const paginatedSolicitations = hasInMemoryFilters
      ? filteredSolicitations.slice(skip, skip + pageSize)
      : filteredSolicitations

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

    return NextResponse.json({ rows, total })
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
