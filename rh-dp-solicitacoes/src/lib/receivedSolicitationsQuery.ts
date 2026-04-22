import { Prisma } from '@prisma/client'
import { buildUtcDateRangeFilter, normalizeFilterText } from './solicitationFilters'

export function buildWhereFromSearchParams(searchParams: URLSearchParams) {
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
    where.protocolo = { contains: protocolo }
  }

  const solicitanteBusca = solicitanteNome || solicitante
  if (solicitanteBusca) {
    where.solicitante = {
      OR: [{ fullName: { contains: solicitanteBusca } }, { email: { contains: solicitanteBusca } }],
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
    where.AND = [
      ...(where.AND ?? []),
      {
        OR: [
          { assumidaPor: { fullName: { contains: responsavel } } },
          { approver: { fullName: { contains: responsavel } } },
        ],
      },
    ]
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
    where.AND = [
      ...(where.AND ?? []),
      {
        OR: [
          { titulo: { contains: text } },
          { descricao: { contains: text } },
          { payload: { path: '$.campos', string_contains: text } },
          { payload: { path: '$', string_contains: text } },
          { payload: { path: '$.formulario', string_contains: text } },
          { payload: { path: '$.form', string_contains: text } },
          { payload: { path: '$.metadata', string_contains: text } },
          { payload: { path: '$.requestData', string_contains: text } },
          { payload: { path: '$.dynamicForm', string_contains: text } },
          { payload: { path: '$.answers', string_contains: text } },
          { payload: { path: '$.fields', string_contains: text } },
          { payload: { path: '$.avaliacaoGestor', string_contains: text } },
        ],
      },
    ]
  }

  return where
}

export function buildListAndCountArgs(
  where: Prisma.SolicitationWhereInput,
  {
    skip,
    pageSize,
    orderBy,
  }: {
    skip: number
    pageSize: number
    orderBy: Prisma.SolicitationOrderByWithRelationInput[]
  },
) {
  return {
    findManyArgs: {
      where,
      skip,
      take: pageSize,
      orderBy,
      include: {
        tipo: { select: { codigo: true, nome: true } },
        department: { select: { name: true } },
        costCenter: { select: { description: true, externalCode: true, code: true } },
        approver: { select: { id: true, fullName: true } },
        assumidaPor: { select: { id: true, fullName: true } },
        solicitante: { select: { id: true, fullName: true } },
        solicitacaoSetores: { select: { status: true, constaFlag: true } },
        eventos: {
          where: {
            tipo: {
              in: ['FINALIZADA', 'FINALIZADA_RH', 'FINALIZADA_DP', 'FINALIZADA_TI'],
            },
          },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          include: { actor: { select: { id: true, fullName: true } } },
        },
      },
    } satisfies Prisma.SolicitationFindManyArgs,
    countArgs: { where } satisfies Prisma.SolicitationCountArgs,
  }
}
