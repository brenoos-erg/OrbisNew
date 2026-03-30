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
import { buildUtcDateRangeFilter, normalizeFilterText } from '@/lib/solicitationFilters'


function buildWhereFromSearchParams(searchParams: URLSearchParams) {
  const where: any = {}

  const openedDate = searchParams.get('openedDate')
  const dateStart = searchParams.get('dateStart') ?? searchParams.get('openedStart')
  const dateEnd = searchParams.get('dateEnd') ?? searchParams.get('openedEnd')
  const closedDate = searchParams.get('closedDate')
  const closedStart = searchParams.get('closedStart')
  const closedEnd = searchParams.get('closedEnd')
  const centerId = searchParams.get('centerId')
  const costCenterId = searchParams.get('costCenterId') ?? centerId
  const departmentId = searchParams.get('departmentId')
  const tipoId = searchParams.get('tipoId')
  const protocolo = normalizeFilterText(searchParams.get('protocolo'))
  const solicitante = normalizeFilterText(searchParams.get('solicitante'))
  const solicitanteNome = normalizeFilterText(searchParams.get('solicitanteNome'))
  const solicitanteLogin = normalizeFilterText(searchParams.get('solicitanteLogin'))
  const matricula = normalizeFilterText(searchParams.get('matricula'))
  const status = normalizeFilterText(searchParams.get('status'))
  const situacao = normalizeFilterText(searchParams.get('situacao'))
  const responsavel = normalizeFilterText(searchParams.get('responsavel'))
  const text = normalizeFilterText(searchParams.get('text'))

  if (openedDate) {
    where.dataAbertura = {
      gte: new Date(`${openedDate}T00:00:00`),
      lte: new Date(`${openedDate}T23:59:59`),
    }
  } else {
    const openedRange = buildUtcDateRangeFilter({ start: dateStart, end: dateEnd })
    if (openedRange) where.dataAbertura = openedRange

  }

  if (departmentId) where.departmentId = departmentId
  if (costCenterId) where.costCenterId = costCenterId
  if (tipoId) where.tipoId = tipoId

  if (closedDate) {
    where.dataFechamento = {
      gte: new Date(`${closedDate}T00:00:00`),
      lte: new Date(`${closedDate}T23:59:59`),
    }
  } else {
    const closedRange = buildUtcDateRangeFilter({ start: closedStart, end: closedEnd })
    if (closedRange) where.dataFechamento = closedRange
  }

  const hasProtocoloFilter = protocolo.length > 0

  if (status) {
    where.status = status
  } else if (situacao) {
    const statusBySituacao: Record<string, string[]> = {
      PENDENTE: ['ABERTA', 'AGUARDANDO_APROVACAO', 'AGUARDANDO_TERMO'],
      EM_ATENDIMENTO: ['EM_ATENDIMENTO', 'AGUARDANDO_AVALIACAO_GESTOR', 'AGUARDANDO_FINALIZACAO_AVALIACAO'],
      FINALIZADO: ['CONCLUIDA'],
      REJEITADO: ['CANCELADA'],
    }
    if (statusBySituacao[situacao]) {
      where.status = { in: statusBySituacao[situacao] }
    }
  }


if (hasProtocoloFilter) {
    where.protocolo = {
      contains: protocolo,
    }
  }
  const solicitanteBusca = solicitanteNome || solicitante
  if (solicitanteBusca) {
    where.solicitante = {
      OR: [
         { fullName: { contains: solicitanteBusca } },
        { email: { contains: solicitanteBusca } },
      ],
    }
  }

  if (solicitanteLogin) {
    where.solicitante = {
      ...(where.solicitante ?? {}),
      ...(where.solicitante?.OR ? {} : { OR: [] }),
      login: { contains: solicitanteLogin },
    }
  }

  if (responsavel) {
    where.assumidaPor = {
      fullName: { contains: responsavel },
    }
  }

  if (matricula) {
    where.AND = [
      ...(where.AND ?? []),
      {
        OR: [
          {
            payload: {
              path: '$.solicitante.matricula',
              string_contains: matricula,
            },
          },
        ],
      },
    ]
  }
  if (text) {
    const textValue = text
    where.AND = [
      ...(where.AND ?? []),
      {
        OR: [
          { titulo: { contains: textValue } },
          { descricao: { contains: textValue } },
          { payload: { path: '$.campos', string_contains: textValue } },
          { payload: { path: '$.formulario', string_contains: textValue } },
          { payload: { path: '$.form', string_contains: textValue } },
          { payload: { path: '$.metadata', string_contains: textValue } },
          { payload: { path: '$.requestData', string_contains: textValue } },
          { payload: { path: '$.dynamicForm', string_contains: textValue } },
          { payload: { path: '$.answers', string_contains: textValue } },
          { payload: { path: '$.fields', string_contains: textValue } },
          { payload: { path: '$.avaliacaoGestor', string_contains: textValue } },
        ],
      },
    ]
  }


  return where
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


    const userAccess = await resolveUserAccessContext({
      userId: me.id,
      role: me.role,
      primaryDepartmentId: me.departmentId,
      primaryDepartment: me.department,
    })
  const gestorAvaliadorFilter = {
      approverId: me.id,
      status: 'AGUARDANDO_AVALIACAO_GESTOR' as const,
    }


    where.AND = [
      ...(where.AND ?? []),
      {
        OR: [
          buildReceivedWhereByPolicy(userAccess),
          gestorAvaliadorFilter,
        ],
      },
    ]


    const userDepartmentIdsForSensitive = await getUserDepartmentIds(me.id, me.departmentId)
    where.AND = [
      ...(where.AND ?? []),
      buildSensitiveHiringVisibilityWhere({
        userId: me.id,
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
            { OR: [{ tipo: { id: 'RQ_063' } }, { tipo: { codigo: 'RQ.RH.001' } }] },
          ],
        },
      },
    ]

   const [solicitations, total] = await Promise.all([
      prisma.solicitation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { dataAbertura: 'desc' },
        include: {
          tipo: { select: { codigo: true, nome: true } },
          department: { select: { name: true } },
          costCenter: { select: { description: true, externalCode: true, code: true } },
          approver: { select: { id: true, fullName: true } },
          assumidaPor: { select: { id: true, fullName: true } },
          solicitante: { select: { id: true, fullName: true } },
          eventos: {
            where: {
              tipo: {
                in: ['FINALIZADA', 'FINALIZADA_RH', 'FINALIZADA_DP', 'FINALIZADA_TI'],
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { actor: { select: { id: true, fullName: true } } },
          },
        },
      }),
      prisma.solicitation.count({ where }),
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
      sla: null,
      setorDestino: s.department?.name ?? formatCostCenterLabel(s.costCenter, ''),
      departamentoResponsavel: s.department?.name ?? null,
      requiresApproval: s.requiresApproval,
      approvalStatus: s.approvalStatus,
      costCenterId: s.costCenterId ?? null,
      approverId: s.approver?.id ?? s.approverId ?? null,
      }
    })

    return NextResponse.json({ rows, total })
  } catch (err) {
    console.error('GET /api/solicitacoes/recebidas error', err)
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