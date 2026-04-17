export const dynamic = 'force-dynamic'
export const revalidate = 0

// rh-dp-solicitacoes/src/app/api/solicitacoes/recebidas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { formatCostCenterLabel } from '@/lib/costCenter'
import { buildSensitiveHiringVisibilityWhere, getUserDepartmentIds } from '@/lib/sensitiveHiringRequests'
import { buildReceivedWhereByPolicy, resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'
import { buildListAndCountArgs, buildWhereFromSearchParams } from '@/lib/receivedSolicitationsQuery'

function resolveOrderBy(searchParams: URLSearchParams): Prisma.SolicitationOrderByWithRelationInput[] {
  const sortBy = searchParams.get('sortBy') ?? 'dataAbertura'
  const sortDir = (searchParams.get('sortDir') ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'
  if (sortBy === 'protocolo') return [{ protocolo: sortDir }]
  if (sortBy === 'nomeSolicitante') return [{ solicitante: { fullName: sortDir } }]
  if (sortBy === 'departamentoResponsavel') return [{ department: { name: sortDir } }]
  if (sortBy === 'atendente') return [{ assumidaPor: { fullName: sortDir } }]
  if (sortBy === 'status') return [{ status: sortDir }]
  return [{ dataAbertura: sortDir }]
}

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
    const where = buildWhereFromSearchParams(searchParams)
    const orderBy = resolveOrderBy(searchParams)


    const userAccess = await resolveUserAccessContext({
      userId: me.id,
      userLogin: me.login,
      userEmail: me.email,
      userFullName: me.fullName,
      role: me.role,
      primaryDepartmentId: me.departmentId,
      primaryDepartment: me.department,
    })
    where.AND = [
      ...(where.AND ?? []),
      buildReceivedWhereByPolicy(userAccess),
    ]

    const userDepartmentIdsForSensitive = await getUserDepartmentIds(me.id, me.departmentId)
    where.AND = [
      ...(where.AND ?? []),
      buildSensitiveHiringVisibilityWhere({
        userId: me.id,
        userLogin: me.login,
        userEmail: me.email,
        userFullName: me.fullName,
        role: me.role,
        departmentIds: userDepartmentIdsForSensitive,
      }),
    ]

     where.AND = [
      ...(where.AND ?? []),
      {
        NOT: {
          AND: [
            { requiresApproval: true },
            { approvalStatus: 'PENDENTE' },
            { OR: [{ tipo: { id: 'RQ_063' } }, { tipo: { codigo: { in: ['RQ.RH.063', 'RQ.063', 'RQ.RH.001'] } } }] },
          ],
        },
      },
    ]

   const { findManyArgs, countArgs } = buildListAndCountArgs(where, {
      skip,
      pageSize,
      orderBy,
    })

   const [solicitations, total] = await Promise.all([
      prisma.solicitation.findMany(findManyArgs),
      prisma.solicitation.count(countArgs),
    ])

   const rows = solicitations.map((s) => {
      const finalizadorEvent = s.eventos?.[0] ?? null

      return {
      id: s.id,
      titulo: s.titulo,
      status: s.status,
      protocolo: s.protocolo,
      createdAt: s.dataAbertura ? s.dataAbertura.toISOString() : null,
      tipo: s.tipo ? { codigo: s.tipo.codigo, nome: s.tipo.nome } : null,
      responsavelId: s.assumidaPor?.id ?? null,
      responsavel: s.assumidaPor ? { fullName: s.assumidaPor.fullName } : null,
      finalizadorId: finalizadorEvent?.actor?.id ?? null,
      finalizador: finalizadorEvent?.actor
        ? { fullName: finalizadorEvent.actor.fullName }
        : null,
      autor: s.solicitante ? { fullName: s.solicitante.fullName } : null,
      solicitanteNome: s.solicitante?.fullName ?? null,
      sla: null,
      setorDestino: s.department?.name ?? formatCostCenterLabel(s.costCenter, ''),
      departamentoResponsavel: s.department?.name ?? null,
      requiresApproval: s.requiresApproval,
      approvalStatus: s.approvalStatus,
      costCenterId: s.costCenterId ?? null,
      approverId: s.approver?.id ?? s.approverId ?? null,
      nadaConstaStatus:
        s.solicitacaoSetores.length === 0
          ? null
          : s.solicitacaoSetores.every((setor) => setor.status === 'CONCLUIDO' && Boolean(setor.constaFlag))
            ? 'PREENCHIDO'
            : 'PENDENTE',
      }
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
      err instanceof Error &&
      err.message === 'Serviço indisponível. Não foi possível conectar ao banco de dados.'
    ) {
      return NextResponse.json({ error: err.message, dbUnavailable: true }, { status: 503 })
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
