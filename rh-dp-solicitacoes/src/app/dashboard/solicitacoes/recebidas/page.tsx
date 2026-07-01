// src/app/dashboard/solicitacoes/recebidas/page.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Printer, X } from 'lucide-react'
import { SolicitationStatusBadge } from '@/components/solicitacoes/SolicitationStatusBadge'
import { getStatusPresentation } from '@/lib/solicitationStatusPresentation'
import { formatDateDDMMYYYY } from '@/lib/date'
import {
  Row,
  SolicitationDetail,
  SolicitationDetailModal,
} from '@/components/solicitacoes/SolicitationDetailModal'
import { isSolicitacaoIncentivoEducacao } from '@/lib/solicitationTypes'
import { useSessionMe } from '@/components/session/SessionProvider'

type FilterState = {
  q: string
  protocolo: string
  solicitanteNome: string
  solicitanteLogin: string
  matricula: string
  tipoId: string
  departmentId: string
  costCenterId: string
  status: string
  situacao: string
  responsavel: string
  openedDate: string
  openedStart: string
  openedEnd: string
  closedDate: string
  closedStart: string
  closedEnd: string
  text: string
  page: number
  pageSize: number
  sortBy: string
  sortDir: 'asc' | 'desc'
}

type ProtocolFilterDiagnostic =
  | { status: 'not_checked' }
  | { status: 'not_visible_or_not_found'; message: string }
  | {
      status: 'visible_type_mismatch'
      protocolo: string
      selectedTipoId: string
      foundTipo: { id: string; codigo: string | null; nome: string }
      solicitationId: string
    }
  | {
      status: 'found_outside_received'
      protocolo: string
      statusAtual: string
      etapaAtual: string
      setorResponsavelAtual: string
      flowUrl: string
      message: string
    }
  | {
      status: 'found_without_permission'
      protocolo: string
      message: string
    }

type ListResponse = {
  rows: Row[]
  total: number
  protocolFilterDiagnostic?: ProtocolFilterDiagnostic
}

type PaginationItem = number | 'ellipsis'

type TipoOption = { id: string; codigo?: string | null; nome: string }
type DepartmentOption = { id: string; label: string; description?: string }
type CostCenterOption = {
  id: string
  code?: string | null
  externalCode?: string | null
  description: string
}

const DEFAULT_FILTERS: FilterState = {
  q: '',
  protocolo: '',
  solicitanteNome: '',
  solicitanteLogin: '',
  matricula: '',
  tipoId: '',
  departmentId: '',
  costCenterId: '',
  status: '',
  situacao: '',
  responsavel: '',
  openedDate: '',
  openedStart: '',
  openedEnd: '',
  closedDate: '',
  closedStart: '',
  closedEnd: '',
  text: '',
  page: 1,
  pageSize: 10,
  sortBy: 'dataAbertura',
  sortDir: 'desc',
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ABERTA', label: 'Aguardando atendimento' },
  { value: 'EM_ATENDIMENTO', label: 'Em atendimento' },
  { value: 'AGUARDANDO_APROVACAO', label: 'Aguardando aprovação' },
  { value: 'AGUARDANDO_TERMO', label: 'Aguardando termo' },
  { value: 'AGUARDANDO_AVALIACAO_GESTOR', label: 'Aguardando avaliação gestor' },
  { value: 'AGUARDANDO_FINALIZACAO_AVALIACAO', label: 'Aguardando finalização RH' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'CANCELADA', label: 'Cancelada / Recusada' },
]

const SITUACAO_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_ATENDIMENTO', label: 'Em atendimento' },
  { value: 'FINALIZADO', label: 'Finalizado' },
  { value: 'REJEITADO', label: 'Rejeitado/Recusado' },
]

type ActiveFilterChip = { key: keyof FilterState; label: string; value: string }

const FILTER_KEYS: Array<keyof FilterState> = [
  'q',
  'protocolo',
  'solicitanteNome',
  'solicitanteLogin',
  'matricula',
  'tipoId',
  'departmentId',
  'costCenterId',
  'status',
  'situacao',
  'responsavel',
  'openedDate',
  'openedStart',
  'openedEnd',
  'closedDate',
  'closedStart',
  'closedEnd',
  'text',
]

function formatTipoLabel(tipo?: TipoOption | null) {
  if (!tipo) return 'Tipo não identificado'
  return tipo.codigo ? `${tipo.codigo} - ${tipo.nome}` : tipo.nome
}

function safeText(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = String(value).trim()
  if (!text || ['undefined', 'null', 'NaN'].includes(text)) return ''
  return text
}

function formatSolicitationType(row: Pick<Row, 'tipo' | 'titulo'>) {
  const codigo = safeText(row.tipo?.codigo)
  const nome = safeText(row.tipo?.nome)
  const titulo = safeText(row.titulo)
  if (codigo && nome) return `${codigo} - ${nome}`
  if (nome) return nome
  if (titulo) return titulo
  return 'Tipo não identificado'
}

function formatAssignee(row: Row) {
  const responsibleName = safeText(row.responsavel?.fullName)
  const finalizerName = safeText(row.finalizador?.fullName)
  if (row.status === 'CONCLUIDA') return finalizerName || responsibleName || '-'
  if (responsibleName) return responsibleName
  if (row.requiresApproval && row.approvalStatus === 'PENDENTE') {
    return row.approverId ? 'Aguardando aprovação' : 'Aguardando aprovação de responsável'
  }
  if (row.status === 'ABERTA') {
    if (safeText(row.setorDestino) || safeText(row.departmentId) || safeText(row.costCenterId)) {
      return 'Aguardando setor assumir'
    }
    return 'Aguardando responsável'
  }
  return '-'
}

function formatCostCenterOptionLabel(center?: CostCenterOption | null) {
  if (!center) return 'Centro de custo não identificado'
  return `${center.externalCode ?? center.code ?? '-'} - ${center.description}`
}

function formatDateFilterLabel(value: string) {
  if (!value) return ''
  return value.split('-').reverse().join('/')
}

function buildActiveFilterChips(
  filters: FilterState,
  {
    tipos,
    departments,
    costCenters,
  }: {
    tipos: TipoOption[]
    departments: DepartmentOption[]
    costCenters: CostCenterOption[]
  },
): ActiveFilterChip[] {
  const labels: Partial<Record<keyof FilterState, string>> = {
    q: 'Busca',
    protocolo: 'Protocolo',
    solicitanteNome: 'Nome do solicitante',
    solicitanteLogin: 'Login',
    matricula: 'Matrícula',
    tipoId: 'Tipo de solicitação',
    departmentId: 'Setor responsável',
    costCenterId: 'Centro de custo',
    status: 'Status',
    situacao: 'Situação',
    responsavel: 'Responsável',
    openedDate: 'Data de abertura',
    openedStart: 'Abertura inicial',
    openedEnd: 'Abertura final',
    closedDate: 'Data de fechamento',
    closedStart: 'Fechamento inicial',
    closedEnd: 'Fechamento final',
    text: 'Texto no formulário',
  }

  return FILTER_KEYS.flatMap((key) => {
    const rawValue = filters[key]
    if (!rawValue || typeof rawValue !== 'string') return []

    let value = rawValue
    if (key === 'tipoId') value = formatTipoLabel(tipos.find((tipo) => tipo.id === rawValue))
    if (key === 'departmentId') value = departments.find((department) => department.id === rawValue)?.label ?? rawValue
    if (key === 'costCenterId') value = formatCostCenterOptionLabel(costCenters.find((center) => center.id === rawValue))
    if (key === 'status') value = STATUS_OPTIONS.find((option) => option.value === rawValue)?.label ?? rawValue
    if (key === 'situacao') value = SITUACAO_OPTIONS.find((option) => option.value === rawValue)?.label ?? rawValue
    if (['openedDate', 'openedStart', 'openedEnd', 'closedDate', 'closedStart', 'closedEnd'].includes(key)) {
      value = formatDateFilterLabel(rawValue)
    }

    return [{ key, label: labels[key] ?? String(key), value }]
  })
}


function buildPaginationItems(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages = new Set<number>([1, totalPages])
  for (
    let page = Math.max(2, currentPage - 2);
    page <= Math.min(totalPages - 1, currentPage + 2);
    page += 1
  ) {
    pages.add(page)
  }

  const sortedPages = Array.from(pages).sort((a, b) => a - b)
  const items: PaginationItem[] = []

  sortedPages.forEach((page, index) => {
    if (index > 0) {
      const previousPage = sortedPages[index - 1]
      if (page - previousPage > 1) {
        items.push('ellipsis')
      }
    }
    items.push(page)
  })

  return items
}

export default function ReceivedRequestsPage() {
  const { data: sessionData, loading: sessionLoading, refresh: refreshSession } = useSessionMe()
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [formFilters, setFormFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tipos, setTipos] = useState<TipoOption[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([])

  const [selectedRow, setSelectedRow] = useState<Row | null>(null)
  const [detail, setDetail] = useState<SolicitationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailMode, setDetailMode] = useState<'default' | 'approval'>('default')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)

  useEffect(() => {
    if (sessionLoading) return
    if (sessionExpired) return
    if (sessionData?.appUser) return

    setSessionExpired(true)
    setData({ rows: [], total: 0 })
    setError('Sua sessão expirou. Faça login novamente.')
  }, [sessionData?.appUser, sessionExpired, sessionLoading])

  async function fetchList() {
    if (sessionLoading) return
    if (sessionExpired) return
    if (!sessionData?.appUser) {
      setSessionExpired(true)
      setData({ rows: [], total: 0 })
      setError('Sua sessão expirou. Faça login novamente.')
      return
    }

    setLoading(true)
    setError(null)

      try {
      const params = new URLSearchParams()
      params.set('page', String(filters.page))
      params.set('pageSize', String(filters.pageSize))
      params.set('sortBy', filters.sortBy)
      params.set('sortDir', filters.sortDir)

      if (filters.q) params.set('q', filters.q)
      if (filters.q) params.set('q', filters.q)
    if (filters.protocolo) params.set('protocolo', filters.protocolo)
      if (filters.solicitanteNome) params.set('solicitanteNome', filters.solicitanteNome)
      if (filters.solicitanteLogin) params.set('solicitanteLogin', filters.solicitanteLogin)
      if (filters.matricula) params.set('matricula', filters.matricula)
      if (filters.tipoId) params.set('tipoId', filters.tipoId)
      if (filters.departmentId) params.set('departmentId', filters.departmentId)
      if (filters.costCenterId) params.set('costCenterId', filters.costCenterId)
      if (filters.status) params.set('status', filters.status)
      if (filters.situacao) params.set('situacao', filters.situacao)
      if (filters.responsavel) params.set('responsavel', filters.responsavel)

      if (filters.openedDate) {
        params.set('openedDate', filters.openedDate)
      } else {
        if (filters.openedStart) params.set('openedStart', filters.openedStart)
        if (filters.openedEnd) params.set('openedEnd', filters.openedEnd)
      }

      if (filters.closedDate) {
        params.set('closedDate', filters.closedDate)
      } else {
        if (filters.closedStart) params.set('closedStart', filters.closedStart)
        if (filters.closedEnd) params.set('closedEnd', filters.closedEnd)
      }
      if (filters.text) params.set('text', filters.text)

      const res = await fetch(`/api/solicitacoes/recebidas?${params.toString()}`)
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => null)
        if (res.status === 401) {
          setSessionExpired(true)
          await refreshSession({ force: true })
        }
        throw new Error(
          errorPayload?.error ??
            (res.status === 401
              ? 'Sua sessão expirou. Faça login novamente.'
              : 'Erro ao buscar solicitações recebidas.'),
        )
      }

      const json = (await res.json()) as ListResponse
      setData(json)
    } catch (err: any) {
      console.error(err)
      setError(err?.message ?? 'Erro ao buscar solicitações recebidas.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchFilterOptions() {
    if (sessionLoading) return
    if (sessionExpired) return
    if (!sessionData?.appUser) return

    try {
      const [tiposRes, depRes, ccRes] = await Promise.all([
        fetch('/api/tipos-solicitacao'),
        fetch('/api/departments'),
        fetch('/api/cost-centers/select'),
      ])

      if (tiposRes.ok) setTipos(await tiposRes.json())
      if (depRes.ok) setDepartments(await depRes.json())
      if (ccRes.ok) setCostCenters(await ccRes.json())
    } catch (err) {
      console.error('Erro ao carregar opções de filtro', err)
    }
  }


  async function fetchDetail(row: Row) {
    setSelectedRow(row)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    const shouldOpenInApprovalMode =
      isSolicitacaoIncentivoEducacao(row.tipo) &&
      row.requiresApproval &&
      row.approvalStatus === 'PENDENTE'

    setDetailMode(shouldOpenInApprovalMode ? 'approval' : 'default')
    try {
      const res = await fetch(`/api/solicitacoes/${row.id}`)
      if (!res.ok) {
        throw new Error('Erro ao buscar detalhes da solicitação.')
      }
        const json = (await res.json()) as SolicitationDetail
      setDetail(json)
    } catch (err: any) {
      console.error(err)
      setDetailError(err?.message ?? 'Erro ao buscar detalhes.')
    } finally {
      setDetailLoading(false)
    }
  }

  const activeFilterChips = useMemo(
    () => buildActiveFilterChips(filters, { tipos, departments, costCenters }),
    [costCenters, departments, filters, tipos],
  )
  const filterCount = activeFilterChips.length
  const selectedTipoLabel = filters.tipoId
    ? formatTipoLabel(tipos.find((tipo) => tipo.id === filters.tipoId))
    : ''

  function updateFilters(next: FilterState) {
    setFormFilters(next)
    setFilters(next)
  }

  function clearAllFilters() {
    updateFilters({ ...DEFAULT_FILTERS, pageSize: filters.pageSize })
  }

  function removeFilter(key: keyof FilterState) {
    setFilters((prev) => {
      const next = { ...prev, [key]: '', page: 1 }
      setFormFilters((formPrev) => ({ ...formPrev, [key]: '', page: 1 }))
      return next
    })
  }

  function removeTipoFilter() {
    removeFilter('tipoId')
  }


  useEffect(() => {
    if (sessionLoading) return
    if (sessionExpired) return
    if (!sessionData?.appUser) return

    fetchList()
    const hasActiveFilters = activeFilterChips.length > 0
    if (hasActiveFilters) return

    const interval = setInterval(fetchList, 60000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sessionData?.appUser, sessionExpired, sessionLoading])

  useEffect(() => {
    fetchFilterOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.appUser, sessionExpired, sessionLoading])

  useEffect(() => {
    if (!detailOpen || !selectedRow) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/solicitacoes/${selectedRow.id}`, {
          cache: 'no-store',
        })
        if (!res.ok) return

        const json = (await res.json()) as SolicitationDetail
        setDetail(json)
      } catch (err) {
        console.error('Erro ao atualizar detalhes da solicitação', err)
      }
    }, 5000)

      return () => clearInterval(interval)
  }, [detailOpen, selectedRow])

  const rows = data?.rows ?? []
  const page = filters.page
  const pageSize = filters.pageSize
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const paginationItems = buildPaginationItems(page, totalPages)
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total)
  function handleSort(sortBy: string) {
    setFilters((prev) => {
      const nextSortDir: 'asc' | 'desc' =
        prev.sortBy === sortBy && prev.sortDir === 'asc' ? 'desc' : 'asc'
      const next = {
        ...prev,
        page: 1,
        sortBy,
        sortDir: nextSortDir,
      }
      setFormFilters((formPrev) => ({ ...formPrev, sortBy: next.sortBy, sortDir: next.sortDir }))
      return next
    })
  }

  function sortIndicator(sortBy: string) {
    if (filters.sortBy !== sortBy) return '↕'
    return filters.sortDir === 'asc' ? '↑' : '↓'
  }

  async function exportExcel() {
    if (sessionLoading) return
    if (sessionExpired) return
    if (!sessionData?.appUser) {
      setSessionExpired(true)
      setError('Sua sessão expirou. Faça login novamente.')
      return
    }

    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('pageSize', '1000')
    params.set('sortBy', filters.sortBy)
    params.set('sortDir', filters.sortDir)
    if (filters.q) params.set('q', filters.q)
    if (filters.protocolo) params.set('protocolo', filters.protocolo)
    if (filters.solicitanteNome) params.set('solicitanteNome', filters.solicitanteNome)
    if (filters.solicitanteLogin) params.set('solicitanteLogin', filters.solicitanteLogin)
    if (filters.matricula) params.set('matricula', filters.matricula)
    if (filters.tipoId) params.set('tipoId', filters.tipoId)
    if (filters.departmentId) params.set('departmentId', filters.departmentId)
    if (filters.costCenterId) params.set('costCenterId', filters.costCenterId)
    if (filters.status) params.set('status', filters.status)
    if (filters.situacao) params.set('situacao', filters.situacao)
    if (filters.responsavel) params.set('responsavel', filters.responsavel)
    if (filters.openedDate) params.set('openedDate', filters.openedDate)
    if (filters.openedStart) params.set('openedStart', filters.openedStart)
    if (filters.openedEnd) params.set('openedEnd', filters.openedEnd)
    if (filters.closedDate) params.set('closedDate', filters.closedDate)
    if (filters.closedStart) params.set('closedStart', filters.closedStart)
    if (filters.closedEnd) params.set('closedEnd', filters.closedEnd)
    if (filters.text) params.set('text', filters.text)
    const res = await fetch(`/api/solicitacoes/recebidas?${params.toString()}`)
    if (!res.ok) {
      if (res.status === 401) {
        setSessionExpired(true)
        setError('Sua sessão expirou. Faça login novamente.')
        await refreshSession({ force: true })
        return
      }
      setError('Não foi possível exportar os dados.')
      return
    }
    const json = (await res.json()) as ListResponse
    const header = ['Status', 'Protocolo', 'Nome do Solicitante', 'Data de Abertura', 'Solicitação', 'Departamento Responsável', 'Atendente', 'Nada Consta']
    const lines = json.rows.map((row) => [
      getStatusPresentation(row.status).label,
      row.protocolo ?? '',
      row.solicitanteNome ?? row.autor?.fullName ?? '',
      row.createdAt ? formatDateDDMMYYYY(row.createdAt) : '',
      formatSolicitationType(row),
      row.setorDestino ?? '',
      formatAssignee(row),
      row.nadaConstaStatus === 'PREENCHIDO' ? 'Preenchido' : row.nadaConstaStatus === 'PENDENTE' ? 'Pendente' : '',
    ])
    const csv = [header, ...lines].map((line) => line.map((col) => `"${String(col).replaceAll('"', '""')}"`).join(';')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `solicitacoes-recebidas-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-page p-6">
      <div>
          <h1 className="app-title text-xl md:text-2xl">Solicitações Recebidas</h1>
        <p className="app-subtitle">
          Visualize e trate as solicitações destinadas aos centros de custo em que você está vinculado.
        </p>
      </div>

      <div className="app-filter-bar space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="app-label" htmlFor="received-search-main">Buscar chamado</label>
            <input
              id="received-search-main"
              className="app-input mt-1"
              placeholder="Digite protocolo, nome, matrícula, cargo, centro de custo, setor, responsável, texto do formulário, anexo ou comentário"
              value={formFilters.q}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, q: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setFilters((prev) => ({ ...formFilters, page: 1, pageSize: prev.pageSize }))
                }
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="app-button-primary disabled:opacity-50"
              disabled={loading}
              onClick={() => setFilters((prev) => ({ ...formFilters, page: 1, pageSize: prev.pageSize }))}
            >
              Pesquisar
            </button>
            <button type="button" className="app-button-secondary" disabled={loading} onClick={clearAllFilters}>
              Limpar
            </button>
            <button type="button" className="app-button-secondary" onClick={() => setAdvancedFiltersOpen((open) => !open)}>
              Filtros avançados {advancedFiltersOpen ? '▲' : '▼'}
            </button>
            <button type="button" className="app-button-secondary" disabled={loading} onClick={fetchList}>
              Atualizar
            </button>
            <button type="button" className="app-button-secondary" onClick={exportExcel}>
              Exportar
            </button>
          </div>
        </div>

        <div className="text-xs app-muted-text">
          <p><strong>Status</strong> é o estado técnico do chamado. <strong>Situação</strong> é um agrupamento; se ambos forem preenchidos, Status prevalece.</p>
          <p>Mostrando {rangeStart}-{rangeEnd} de {total} chamados. Filtros ativos: {filterCount}{filters.q ? ` • Busca: ${filters.q}` : ''}</p>
        </div>

        {advancedFiltersOpen && (
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] p-4 lg:grid-cols-3">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide app-muted-text">Classificação</h3>
              <div>
                <label className="app-label">Tipo de solicitação</label>
                <select className="app-select mt-1" value={formFilters.tipoId} onChange={(e) => setFormFilters((prev) => ({ ...prev, tipoId: e.target.value }))}>
                  <option value="">Todos</option>
                  {tipos.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.codigo ? `${tipo.codigo} - ${tipo.nome}` : tipo.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="app-label">Status</label>
                <select className="app-select mt-1" value={formFilters.status} onChange={(e) => setFormFilters((prev) => ({ ...prev, status: e.target.value }))}>
                  {STATUS_OPTIONS.map((option) => <option key={option.value || 'ALL'} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label className="app-label">Situação</label>
                <select className="app-select mt-1" value={formFilters.situacao} onChange={(e) => setFormFilters((prev) => ({ ...prev, situacao: e.target.value }))}>
                  {SITUACAO_OPTIONS.map((option) => <option key={option.value || 'ALL'} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide app-muted-text">Responsabilidade</h3>
              <div>
                <label className="app-label">Setor responsável</label>
                <select className="app-select mt-1" value={formFilters.departmentId} onChange={(e) => setFormFilters((prev) => ({ ...prev, departmentId: e.target.value }))}>
                  <option value="">Todos</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.label}</option>)}
                </select>
              </div>
              <div>
                <label className="app-label">Centro de custo</label>
                <select className="app-select mt-1" value={formFilters.costCenterId} onChange={(e) => setFormFilters((prev) => ({ ...prev, costCenterId: e.target.value }))}>
                  <option value="">Todos</option>
                  {costCenters.map((center) => <option key={center.id} value={center.id}>{center.externalCode ?? center.code ?? '-'} - {center.description}</option>)}
                </select>
              </div>
              <div>
                <label className="app-label">Responsável/atendente</label>
                <input className="app-input mt-1" placeholder="Nome do atendente" value={formFilters.responsavel} onChange={(e) => setFormFilters((prev) => ({ ...prev, responsavel: e.target.value }))} />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide app-muted-text">Datas e escopo</h3>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="app-label">Abertura inicial</label><input type="date" className="app-input mt-1" value={formFilters.openedStart} onChange={(e) => setFormFilters((prev) => ({ ...prev, openedStart: e.target.value, openedDate: '' }))} /></div>
                <div><label className="app-label">Abertura final</label><input type="date" className="app-input mt-1" value={formFilters.openedEnd} onChange={(e) => setFormFilters((prev) => ({ ...prev, openedEnd: e.target.value, openedDate: '' }))} /></div>
                <div><label className="app-label">Fechamento inicial</label><input type="date" className="app-input mt-1" value={formFilters.closedStart} onChange={(e) => setFormFilters((prev) => ({ ...prev, closedStart: e.target.value, closedDate: '' }))} /></div>
                <div><label className="app-label">Fechamento final</label><input type="date" className="app-input mt-1" value={formFilters.closedEnd} onChange={(e) => setFormFilters((prev) => ({ ...prev, closedEnd: e.target.value, closedDate: '' }))} /></div>
              </div>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={false} disabled /> Apenas meus chamados <span className="app-muted-text">(em breve)</span></label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={false} disabled /> Apenas pendentes de ação minha <span className="app-muted-text">(em breve)</span></label>
            </section>
          </div>
        )}

        {activeFilterChips.length > 0 && (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide app-muted-text">Filtros ativos</span>
              <button type="button" className="app-button-secondary px-2 py-1 text-xs" onClick={clearAllFilters} disabled={loading}>Limpar todos os filtros</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeFilterChips.map((chip) => (
                <span key={chip.key} className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--background)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
                  <span className="font-semibold">{chip.label}:</span> {chip.value}
                  <button type="button" className="ml-1 rounded-full p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50" aria-label={`Remover filtro ${chip.label}`} onClick={() => removeFilter(chip.key)} disabled={loading}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {data?.protocolFilterDiagnostic?.status === 'visible_type_mismatch' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Encontramos este protocolo, mas ele não corresponde ao tipo selecionado.</p>
          <p className="mt-1">
            O protocolo {data.protocolFilterDiagnostic.protocolo} é do tipo{' '}
            {formatTipoLabel(data.protocolFilterDiagnostic.foundTipo)}, enquanto o filtro atual está em {selectedTipoLabel}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="app-button-secondary" onClick={removeTipoFilter} disabled={loading}>
              Limpar tipo de solicitação e buscar novamente
            </button>
            <button
              type="button"
              className="app-button-primary"
              onClick={() => {
                const diagnostic = data.protocolFilterDiagnostic
                if (diagnostic?.status === 'visible_type_mismatch') {
                  window.open(`/dashboard/solicitacoes/${diagnostic.solicitationId}`, '_blank', 'noopener,noreferrer')
                }
              }}
            >
              Abrir solicitação encontrada
            </button>
          </div>
        </div>
      )}

      {data?.protocolFilterDiagnostic?.status === 'found_outside_received' && filters.protocolo && rows.length === 0 && !loading && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">Este protocolo existe, mas não está nas suas Solicitações Recebidas no momento.</p>
          <p className="mt-1">{data.protocolFilterDiagnostic.message}</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-blue-700">Status atual</dt>
              <dd>{data.protocolFilterDiagnostic.statusAtual}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-blue-700">Etapa atual</dt>
              <dd>{data.protocolFilterDiagnostic.etapaAtual}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-blue-700">Setor responsável atual</dt>
              <dd>{data.protocolFilterDiagnostic.setorResponsavelAtual}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="app-button-primary mt-3"
            onClick={() => {
              const diagnostic = data.protocolFilterDiagnostic
              if (diagnostic?.status === 'found_outside_received') {
                window.open(diagnostic.flowUrl, '_blank', 'noopener,noreferrer')
              }
            }}
          >
            Abrir fluxo do chamado
          </button>
        </div>
      )}

      {data?.protocolFilterDiagnostic?.status === 'found_without_permission' && filters.protocolo && rows.length === 0 && !loading && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] p-4 text-sm app-muted-text">
          {data.protocolFilterDiagnostic.message}
        </div>
      )}

      {data?.protocolFilterDiagnostic?.status === 'not_visible_or_not_found' && filters.protocolo && filters.tipoId && rows.length === 0 && !loading && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] p-4 text-sm app-muted-text">
          Existe uma divergência nos filtros ou você não possui permissão para visualizar este protocolo.
        </div>
      )}

      <div className="app-table-wrapper flex-1 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-wide app-muted-text">
          <span>Solicitações Recebidas</span>
          <div className="flex items-center gap-2">
            {loading && <span className="text-[11px] app-muted-text">Carregando...</span>}
            <button
              type="button"
              onClick={() => selectedRow?.id && window.open(`/solicitacoes/impressao/${selectedRow.id}`, '_blank', 'noopener,noreferrer')}
              disabled={!selectedRow?.id}
              className="app-button-secondary px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer size={12} /> Imprimir selecionado
            </button>
          </div>
        </div>

          {error && <div className="p-4 text-sm text-[var(--danger)]">{error}</div>}

        <div className="overflow-x-auto">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="app-table-header text-xs uppercase">
                <tr>
                  <th className="px-4 py-2">
                    <button type="button" onClick={() => handleSort('status')}>Status {sortIndicator('status')}</button>
                  </th>
                  <th className="px-4 py-2">
                    <button type="button" onClick={() => handleSort('protocolo')}>Protocolo {sortIndicator('protocolo')}</button>
                  </th>
                  <th className="px-4 py-2">
                    <button type="button" onClick={() => handleSort('nomeSolicitante')}>Nome do Solicitante {sortIndicator('nomeSolicitante')}</button>
                  </th>
                  <th className="px-4 py-2">
                    <button type="button" onClick={() => handleSort('dataAbertura')}>Data Abertura {sortIndicator('dataAbertura')}</button>
                  </th>
                  <th className="px-4 py-2">Solicitação</th>
                  <th className="px-4 py-2">
                    <button type="button" onClick={() => handleSort('departamentoResponsavel')}>Departamento responsável {sortIndicator('departamentoResponsavel')}</button>
                  </th>
                  <th className="px-4 py-2">
                    <button type="button" onClick={() => handleSort('atendente')}>Atendente {sortIndicator('atendente')}</button>
                  </th>
                  <th className="px-4 py-2">Nada Consta</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center app-subtitle">
                      {activeFilterChips.length > 0 ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-[var(--foreground)]">Nenhuma solicitação encontrada com os filtros atuais.</p>
                          <p>Verifique se o protocolo informado pertence ao tipo de solicitação selecionado ou limpe os filtros para ampliar a busca.</p>
                          {filters.protocolo && filters.tipoId && (
                            <p>Dica: o protocolo informado pode pertencer a outro tipo de solicitação.</p>
                          )}
                          <button type="button" className="app-button-secondary mt-2" onClick={clearAllFilters}>
                            Limpar filtros
                          </button>
                        </div>
                      ) : (
                        'Nenhuma solicitação recebida encontrada.'
                      )}
                    </td>
                  </tr>
                )}
    {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="app-table-row cursor-pointer"
                    onClick={() => fetchDetail(row)}
                  >
                    <td className="px-4 py-2 text-xs font-semibold"><SolicitationStatusBadge status={row.status} /></td>
                    <td className="px-4 py-2 text-xs">{row.protocolo}</td>
                    <td className="px-4 py-2 text-xs">{row.solicitanteNome ?? row.autor?.fullName ?? '-'}</td>
                    <td className="px-4 py-2 text-xs">{row.createdAt ? formatDateDDMMYYYY(row.createdAt) : '-'}</td>
                    <td className="px-4 py-2 text-xs">
                      <div>{formatSolicitationType(row)}</div>
                      {row.sharedHiringFlowLabel && (
                        <span className="mt-1 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          {row.sharedHiringFlowLabel}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">{row.setorDestino ?? '-'}</td>
                    <td className="px-4 py-2 text-xs">
                      {formatAssignee(row)}
                    </td>
                    <td className="px-4 py-2 text-xs font-semibold">
                      {row.nadaConstaStatus === 'PREENCHIDO' ? (
                        <span className="app-alert-success inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold">Preenchido</span>
                      ) : row.nadaConstaStatus === 'PENDENTE' ? (
                        <span className="app-alert-warning inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold">Pendente</span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-4 py-2 text-xs app-muted-text">
          <span>
            Mostrando {rangeStart}-{rangeEnd} de {total} solicitações
          </span>

          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-xs app-muted-text">
              Itens por página
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value)
                setFilters((prev) => ({
                  ...prev,
                  pageSize: newSize,
                  page: 1,
                }))
                setFormFilters((prev) => ({
                  ...prev,
                  pageSize: newSize,
                  page: 1,
                }))
              }}
              className="app-select !w-auto px-2 py-1 text-xs"
              disabled={loading}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold app-muted-text">
              Página {page}/{totalPages}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                }
                disabled={loading || page <= 1}
                className="app-button-secondary px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>

              {paginationItems.map((item, index) => {
                if (item === 'ellipsis') {
                  return (
                    <span key={`ellipsis-${index}`} className="px-2 text-xs app-muted-text">
                      ...
                    </span>
                  )
                }

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, page: item }))}
                    disabled={loading || item === page}
                    className={`rounded border px-3 py-1 text-xs ${
                      item === page
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-[var(--input-border)] text-[var(--foreground)] hover:bg-[var(--table-row-hover)]'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {item}
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    page: Math.min(totalPages, prev.page + 1),
                  }))
                }
                disabled={loading || page >= totalPages}
                className="app-button-secondary px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>

        <SolicitationDetailModal
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setDetail(null)
          setSelectedRow(null)
        }}
        onFinalized={() => {
          setDetailOpen(false)
          setDetail(null)
          setSelectedRow(null)
          setDetailMode('default')
          void fetchList()
        }}
        row={selectedRow}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        mode={detailMode}
      />
    </div>
  )
}
