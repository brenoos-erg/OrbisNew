import { Prisma } from '@prisma/client'
import { buildUtcDateRangeFilter, normalizeFilterText } from './solicitationFilters'
import { buildReceivedFilterText, buildReceivedResponsibleFilterText, matchesNormalizedTerm, normalizeSearchText } from './receivedSolicitationsQuery'
import { isValidSolicitationStatus, onlyValidSolicitationStatuses } from './solicitationStatuses'

export type SolicitationListFilters = {
  q?: string
  scope?: 'received' | 'sent' | 'approval' | 'all-visible'
  tipoId?: string
  status?: string
  situacao?: string
  departmentId?: string
  costCenterId?: string
  responsibleId?: string
  responsibleText?: string
  openedStart?: string
  openedEnd?: string
  closedStart?: string
  closedEnd?: string
  onlyMine?: boolean
  onlyActionableByMe?: boolean
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

const SITUACAO_STATUS: Record<string, string[]> = {
  PENDENTE: ['ABERTA', 'AGUARDANDO_APROVACAO', 'AGUARDANDO_TERMO'],
  EM_ATENDIMENTO: ['EM_ATENDIMENTO', 'AGUARDANDO_AVALIACAO_GESTOR', 'AGUARDANDO_FINALIZACAO_AVALIACAO'],
  FINALIZADO: ['CONCLUIDA'],
  REJEITADO: ['CANCELADA'],
}

const SORT_MAP: Record<string, Prisma.SolicitationOrderByWithRelationInput> = {
  dataAbertura: { dataAbertura: 'desc' },
  protocolo: { protocolo: 'desc' },
  status: { status: 'desc' },
  tipo: { tipo: { nome: 'desc' } },
  solicitante: { solicitante: { fullName: 'desc' } },
  nomeSolicitante: { solicitante: { fullName: 'desc' } },
  departamentoResponsavel: { department: { name: 'desc' } },
  centroCusto: { costCenter: { description: 'desc' } },
  atendente: { assumidaPor: { fullName: 'desc' } },
}

function first(searchParams: URLSearchParams, names: string[]) {
  for (const name of names) {
    const value = normalizeFilterText(searchParams.get(name))
    if (value) return value
  }
  return undefined
}

function parseBool(value: string | null) {
  return value === '1' || value === 'true' || value === 'TRUE' || value === 'on'
}

export function normalizeSolicitationFilterText(value: unknown): string {
  return normalizeSearchText(normalizeFilterText(value == null ? null : String(value)))
}

export function parseSolicitationListFilters(searchParams: URLSearchParams): SolicitationListFilters {
  const legacyQ = first(searchParams, ['q', 'text', 'protocolo', 'solicitanteNome', 'matricula'])
  const responsibleText = first(searchParams, ['responsibleText', 'responsavel'])
  const openedDate = normalizeFilterText(searchParams.get('openedDate'))
  const closedDate = normalizeFilterText(searchParams.get('closedDate'))
  const rawScope = normalizeFilterText(searchParams.get('scope')) as SolicitationListFilters['scope'] | ''
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(1000, Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '10', 10) || 10))

  return {
    q: legacyQ,
    scope: rawScope || undefined,
    tipoId: first(searchParams, ['tipoId']),
    status: first(searchParams, ['status']),
    situacao: first(searchParams, ['situacao']),
    departmentId: first(searchParams, ['departmentId']),
    costCenterId: first(searchParams, ['costCenterId', 'centerId']),
    responsibleId: first(searchParams, ['responsibleId', 'assumidaPorId']),
    responsibleText,
    openedStart: openedDate || first(searchParams, ['openedStart', 'dateStart']),
    openedEnd: openedDate || first(searchParams, ['openedEnd', 'dateEnd']),
    closedStart: closedDate || first(searchParams, ['closedStart']),
    closedEnd: closedDate || first(searchParams, ['closedEnd']),
    onlyMine: parseBool(searchParams.get('onlyMine')),
    onlyActionableByMe: parseBool(searchParams.get('onlyActionableByMe')),
    page,
    pageSize,
    sortBy: normalizeFilterText(searchParams.get('sortBy')) || 'dataAbertura',
    sortDir,
  }
}

export function buildDateRangeFilter(start?: string, end?: string) {
  return buildUtcDateRangeFilter({ start: start ?? null, end: end ?? null })
}

export function buildBaseWhereFromFilters(filters: SolicitationListFilters): Prisma.SolicitationWhereInput {
  const where: Prisma.SolicitationWhereInput = {}
  const openedRange = buildDateRangeFilter(filters.openedStart, filters.openedEnd)
  const closedRange = buildDateRangeFilter(filters.closedStart, filters.closedEnd)
  if (openedRange) where.dataAbertura = openedRange
  if (closedRange) where.dataFechamento = closedRange
  if (filters.tipoId) where.tipoId = filters.tipoId
  if (filters.departmentId) where.departmentId = filters.departmentId
  if (filters.costCenterId) where.costCenterId = filters.costCenterId
  if (filters.responsibleId) where.assumidaPorId = filters.responsibleId
  if (filters.status && isValidSolicitationStatus(filters.status)) {
    where.status = filters.status
  } else if (filters.situacao && SITUACAO_STATUS[filters.situacao]) {
    const valid = onlyValidSolicitationStatuses(SITUACAO_STATUS[filters.situacao])
    if (valid.length > 0) where.status = { in: valid }
  }
  return where
}

function withDirection(orderBy: Prisma.SolicitationOrderByWithRelationInput, sortDir: 'asc' | 'desc') {
  return JSON.parse(JSON.stringify(orderBy).replaceAll('"desc"', `"${sortDir}"`)) as Prisma.SolicitationOrderByWithRelationInput
}

export function buildSortFromFilters(filters: SolicitationListFilters): Prisma.SolicitationOrderByWithRelationInput[] {
  const sortBy = filters.sortBy && SORT_MAP[filters.sortBy] ? filters.sortBy : 'dataAbertura'
  const sortDir = filters.sortDir === 'asc' ? 'asc' : 'desc'
  return [withDirection(SORT_MAP[sortBy], sortDir)]
}

export function buildPaginationFromFilters(filters: SolicitationListFilters) {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(1000, Math.max(1, filters.pageSize ?? 10))
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

export function buildSearchTextForSolicitation(solicitation: Record<string, unknown>) {
  return buildReceivedFilterText(solicitation)
}

export function applyInMemorySearchFilter<T extends Record<string, unknown>>(rows: T[], q?: string) {
  const term = normalizeSolicitationFilterText(q)
  if (!term) return rows
  return rows.filter((row) => buildSearchTextForSolicitation(row).includes(term))
}

export function applyResponsibleTextFilter<T extends Record<string, unknown>>(rows: T[], responsibleText?: string) {
  const term = normalizeSolicitationFilterText(responsibleText)
  if (!term) return rows
  return rows.filter((row) => matchesNormalizedTerm(buildReceivedResponsibleFilterText(row), term))
}

export function explainWhySolicitationDidNotAppear(protocol: string, filters: SolicitationListFilters, userAccess: unknown) {
  return {
    protocol,
    filters,
    userAccessSummary: userAccess ? 'resolved' : 'not-resolved',
    message: 'Use /api/solicitacoes/diagnostico-filtro para verificar escopo, filtros e permissões do protocolo.',
  }
}
