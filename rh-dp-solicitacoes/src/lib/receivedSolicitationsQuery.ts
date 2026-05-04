import { Prisma } from '@prisma/client'
import { buildUtcDateRangeFilter, normalizeFilterText } from './solicitationFilters'

const GLOBAL_TEXT_CANDIDATE_LIMIT = 500

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function flattenSearchableText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => flattenSearchableText(item)).filter(Boolean).join(' ')
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((item) => flattenSearchableText(item))
      .filter(Boolean)
      .join(' ')
  }
  return ''
}

export function buildWhereFromSearchParams(searchParams: URLSearchParams) {
  const where: Prisma.SolicitationWhereInput = {}

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
  const status = normalizeFilterText(searchParams.get('status'))
  const situacao = normalizeFilterText(searchParams.get('situacao'))

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

  if (status) {
    where.status = status as any
  } else if (situacao) {
    const statusBySituacao: Record<string, string[]> = {
      PENDENTE: ['ABERTA', 'AGUARDANDO_APROVACAO', 'AGUARDANDO_TERMO'],
      EM_ATENDIMENTO: ['EM_ATENDIMENTO', 'AGUARDANDO_AVALIACAO_GESTOR', 'AGUARDANDO_FINALIZACAO_AVALIACAO'],
      FINALIZADO: ['CONCLUIDA'],
      REJEITADO: ['CANCELADA'],
    }
    if (statusBySituacao[situacao]) {
      where.status = { in: statusBySituacao[situacao] as any }
    }
  }

  if (protocolo.length > 0) {
    where.protocolo = { startsWith: protocolo }
  }

  return where
}

export function getGlobalTextSearch(searchParams: URLSearchParams): string {
  return normalizeFilterText(searchParams.get('text'))
}

export function buildSolicitationSearchText(solicitation: Record<string, unknown>): string {
  const parts = [
    flattenSearchableText(solicitation.protocolo),
    flattenSearchableText(solicitation.titulo),
    flattenSearchableText(solicitation.descricao),
    flattenSearchableText(solicitation.status),
    flattenSearchableText(solicitation.tipo),
    flattenSearchableText(solicitation.department),
    flattenSearchableText(solicitation.costCenter),
    flattenSearchableText(solicitation.solicitante),
    flattenSearchableText(solicitation.assumidaPor),
    flattenSearchableText(solicitation.approver),
    flattenSearchableText(solicitation.comentarios),
    flattenSearchableText(solicitation.anexos),
    flattenSearchableText(solicitation.eventos),
    flattenSearchableText(solicitation.timelines),
    flattenSearchableText(solicitation.solicitacaoSetores),
    flattenSearchableText(solicitation.payload),
    flattenSearchableText(solicitation.approvalComment),
  ]

  return normalizeSearchText(parts.filter(Boolean).join(' '))
}

export function buildListAndCountArgs(
  where: Prisma.SolicitationWhereInput,
  {
    skip,
    pageSize,
    orderBy,
    includeGlobalSearchData,
  }: {
    skip: number
    pageSize: number
    orderBy: Prisma.SolicitationOrderByWithRelationInput[]
    includeGlobalSearchData?: boolean
  },
) {
  const take = includeGlobalSearchData ? Math.max(skip + pageSize, GLOBAL_TEXT_CANDIDATE_LIMIT) : pageSize

  return {
    findManyArgs: {
      where,
      skip: includeGlobalSearchData ? 0 : skip,
      take,
      orderBy,
      include: {
        tipo: { select: { codigo: true, nome: true } },
        department: { select: { name: true } },
        costCenter: { select: { description: true, externalCode: true, code: true, abbreviation: true, observations: true } },
        approver: { select: { id: true, fullName: true, login: true, email: true } },
        assumidaPor: { select: { id: true, fullName: true, login: true, email: true } },
        solicitante: { select: { id: true, fullName: true, login: true, email: true } },
        solicitacaoSetores: { select: { status: true, constaFlag: true } },
        comentarios: { select: { texto: true } },
        anexos: { select: { filename: true, url: true } },
        timelines: { select: { status: true, message: true } },
        eventos: {
          orderBy: { createdAt: 'desc' as const },
          include: { actor: { select: { id: true, fullName: true } } },
        },
      },
    } satisfies Prisma.SolicitationFindManyArgs,
    countArgs: { where } satisfies Prisma.SolicitationCountArgs,
  }
}
