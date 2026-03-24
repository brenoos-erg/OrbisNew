import { Prisma, SolicitationStatus } from '@prisma/client'
import { formatCostCenterLabel } from '@/lib/costCenter'
import { normalizeSolicitacaoPessoalMotivoVaga } from '@/lib/solicitationTypes'

export type BiSolicitacaoPessoalFilters = {
  dateStart?: string | null
  dateEnd?: string | null
  status?: string | null
  protocolo?: string | null
  departmentId?: string | null
  solicitante?: string | null
}

export type BiSolicitacaoPessoalRow = {
  protocolo: string
  dthrCriacao: string
  nomeSolicitante: string
  descricaoStatus: string
  cargo: string
  centroCusto: string
  motivoDaVaga: string
  ordem: string | null
}

export const BI_SOLICITACAO_PESSOAL_COLUMNS = [
  'protocolo',
  'Dthr Criacao',
  'Nome Solicitante',
  'Descrição Status',
  'Cargo',
  'CentroCusto',
  'Motivo da Vaga',
  'Ordem',
] as const

export const BI_SOLICITACAO_PESSOAL_TIPO_WHERE = {
  OR: [
    { id: { in: ['RQ_063', 'SOLICITACAO_ADMISSAO'] } },
    { codigo: { in: ['RQ.RH.001', 'RQ.RH.002'] } },
    { nome: { contains: 'Solicitação de pessoal' } },
    { nome: { contains: 'Solicitação de admissão' } },
  ],
} satisfies Prisma.TipoSolicitacaoWhereInput

const statusLabels: Record<string, string> = {
  ABERTA: 'Aberta',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  AGUARDANDO_TERMO: 'Aguardando termo',
  AGUARDANDO_AVALIACAO_GESTOR: 'Aguardando avaliação do gestor',
  EM_ATENDIMENTO: 'Em atendimento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}

function parsePayloadCampos(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {}

  const maybePayload = payload as Record<string, unknown>
  if (maybePayload.campos && typeof maybePayload.campos === 'object') {
    return maybePayload.campos as Record<string, unknown>
  }

  return maybePayload
}

function asCostCenterLike(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const maybe = value as Record<string, unknown>
  return {
    description: typeof maybe.description === 'string' ? maybe.description : null,
    externalCode: typeof maybe.externalCode === 'string' ? maybe.externalCode : null,
    code: typeof maybe.code === 'string' ? maybe.code : null,
  }
}

function pickFirstString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function normalizeStatusLabel(status?: SolicitationStatus | string | null) {
  if (!status) return '-'
  return statusLabels[status] ?? status
}

export function buildBiSolicitacaoPessoalWhere(filters: BiSolicitacaoPessoalFilters) {
  const where: Prisma.SolicitationWhereInput = {
    tipo: BI_SOLICITACAO_PESSOAL_TIPO_WHERE,
  }

  const protocolo = filters.protocolo?.trim() ?? ''
  if (protocolo) {
    where.protocolo = { contains: protocolo }
  }

  const status = filters.status?.trim() ?? ''
  if (status && Object.values(SolicitationStatus).includes(status as SolicitationStatus)) {
    where.status = status as SolicitationStatus
  }

  if (filters.departmentId?.trim()) {
    where.departmentId = filters.departmentId.trim()
  }

  const solicitante = filters.solicitante?.trim() ?? ''
  if (solicitante) {
    where.solicitante = {
      OR: [
        { fullName: { contains: solicitante } },
        { email: { contains: solicitante } },
      ],
    }
  }

  const dateStart = filters.dateStart?.trim()
  const dateEnd = filters.dateEnd?.trim()
  if (dateStart || dateEnd) {
    where.dataAbertura = {}
    if (dateStart) {
      where.dataAbertura.gte = new Date(`${dateStart}T00:00:00`)
    }
    if (dateEnd) {
      where.dataAbertura.lte = new Date(`${dateEnd}T23:59:59`)
    }
  }

  return where
}

export function mapSolicitacaoPessoalBiRow(item: {
  protocolo: string
  dataAbertura: Date
  status: SolicitationStatus
  payload: unknown
  solicitante: { fullName: string | null } | null
  costCenter: { description: string | null; externalCode: string | null; code: string | null } | null
  department: { name: string | null } | null
}): BiSolicitacaoPessoalRow {
  const campos = parsePayloadCampos(item.payload)
  const cargo = pickFirstString(campos, ['cargoNome', 'cargoFinal', 'cargo', 'cargoColaborador'])
  const motivoDaVagaRaw = pickFirstString(campos, ['motivoVaga', 'motivoDaVaga'])
  const motivoDaVaga = normalizeSolicitacaoPessoalMotivoVaga(motivoDaVagaRaw)
  const ordem = pickFirstString(campos, ['ordem', 'ordemVaga', 'ordemServico', 'numeroOrdem'])
  const payloadCostCenter = asCostCenterLike(campos.centroCusto)
  const centroCustoPayloadText = pickFirstString(campos, [
    'centroCustoForm',
    'centroCustoLabel',
    'centroCustoIdLabel',
    'centroCusto',
  ])
  const centroCustoPayload =
    formatCostCenterLabel(payloadCostCenter, '') ||
    centroCustoPayloadText ||
    null
  const centroCustoAmigavel =
    centroCustoPayload ||
    formatCostCenterLabel(item.costCenter, '') ||
    item.department?.name?.trim() ||
    '-'

  return {
    protocolo: item.protocolo,
    dthrCriacao: item.dataAbertura.toISOString(),
    nomeSolicitante: item.solicitante?.fullName ?? '-',
    descricaoStatus: normalizeStatusLabel(item.status),
    cargo: cargo ?? '-',
    centroCusto: centroCustoAmigavel,
    motivoDaVaga: motivoDaVaga ?? '-',
    ordem: ordem ?? null,
  }
}

export function toBiSolicitacaoPessoalModelColumns(row: BiSolicitacaoPessoalRow) {
  return {
    protocolo: row.protocolo,
    'Dthr Criacao': row.dthrCriacao,
    'Nome Solicitante': row.nomeSolicitante,
    'Descrição Status': row.descricaoStatus,
    Cargo: row.cargo,
    CentroCusto: row.centroCusto,
    'Motivo da Vaga': row.motivoDaVaga,
    Ordem: row.ordem ?? '',
  } as Record<(typeof BI_SOLICITACAO_PESSOAL_COLUMNS)[number], string>
}
