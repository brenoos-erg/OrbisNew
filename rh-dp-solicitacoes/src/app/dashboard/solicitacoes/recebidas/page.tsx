// src/app/dashboard/solicitacoes/recebidas/page.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { formatDateDDMMYYYY } from '@/lib/date'
import {
  Row,
  SolicitationDetail,
  SolicitationDetailModal,
} from '@/components/solicitacoes/SolicitationDetailModal'
import { isSolicitacaoIncentivoEducacao } from '@/lib/solicitationTypes'

type FilterState = {
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

type ListResponse = {
  rows: Row[]
  total: number
}

type PaginationItem = number | 'ellipsis'

type TipoOption = { id: string; codigo?: string; nome: string }
type DepartmentOption = { id: string; label: string; description?: string }
type CostCenterOption = {
  id: string
  code?: string | null
  externalCode?: string | null
  description: string
}

const DEFAULT_FILTERS: FilterState = {
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


function mapStatusLabel(status: string) {
  if (status === 'ABERTA') return '⏳ AGUARDANDO ATENDIMENTO'
  if (status === 'EM_ATENDIMENTO') return '👩‍💻 EM ATENDIMENTO'
  if (status === 'AGUARDANDO_APROVACAO') return '⚖️ AGUARD. APROVAÇÃO'
  if (status === 'AGUARDANDO_TERMO') return '✍️ AGUARD. TERMO'
  if (status === 'AGUARDANDO_AVALIACAO_GESTOR') return '👔 AGUARD. AVALIAÇÃO GESTOR'
  if (status === 'AGUARDANDO_FINALIZACAO_AVALIACAO') return '📁 AGUARD. FINALIZAÇÃO RH'
  if (status === 'CONCLUIDA') return '✅ CONCLUÍDA'
  if (status === 'CANCELADA') return '❌ CANCELADA'
  return status
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

  async function fetchList() {
    setLoading(true)
    setError(null)

      try {
      const params = new URLSearchParams()
      params.set('page', String(filters.page))
      params.set('pageSize', String(filters.pageSize))
      params.set('sortBy', filters.sortBy)
      params.set('sortDir', filters.sortDir)

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
        throw new Error(errorPayload?.error ?? 'Erro ao buscar solicitações recebidas.')
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

 const filterCount = useMemo(() => {
    const keys = Object.keys(DEFAULT_FILTERS) as Array<keyof FilterState>
    return keys.filter((key) => {
      if (key === 'page' || key === 'pageSize' || key === 'sortBy' || key === 'sortDir') return false
      return Boolean(filters[key])
    }).length
  }, [filters])


  useEffect(() => {
    fetchList()
    const interval = setInterval(fetchList, 5000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  useEffect(() => {
    fetchFilterOptions()
  }, [])

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
    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('pageSize', '1000')
    params.set('sortBy', filters.sortBy)
    params.set('sortDir', filters.sortDir)
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
      setError('Não foi possível exportar os dados.')
      return
    }
    const json = (await res.json()) as ListResponse
    const header = ['Status', 'Protocolo', 'Nome do Solicitante', 'Data de Abertura', 'Solicitação', 'Departamento Responsável', 'Atendente', 'Nada Consta']
    const lines = json.rows.map((row) => [
      mapStatusLabel(row.status),
      row.protocolo ?? '',
      row.solicitanteNome ?? row.autor?.fullName ?? '',
      row.createdAt ? formatDateDDMMYYYY(row.createdAt) : '',
      row.tipo ? `${row.tipo.codigo ?? ''} - ${row.tipo.nome}` : row.titulo,
      row.setorDestino ?? '',
      row.status === 'ABERTA' ? '-' : row.status === 'CONCLUIDA' ? (row.finalizador?.fullName ?? row.responsavel?.fullName ?? '-') : (row.responsavel?.fullName ?? '-'),
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
    <div className="flex h-full flex-col gap-4 p-6">
      <div>
          <h1 className="text-xl font-semibold text-slate-800">Solicitações Recebidas</h1>
        <p className="text-sm text-slate-500">
          Visualize e trate as solicitações destinadas aos centros de custo em que você está vinculado.
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Filtros avançados</h2>
          <span className="text-xs text-slate-500">Filtros ativos: {filterCount}</span>
       </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Protocolo</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Código do protocolo"
              value={formFilters.protocolo}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, protocolo: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Nome do solicitante</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nome"
              value={formFilters.solicitanteNome}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, solicitanteNome: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Login do solicitante</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Login"
              value={formFilters.solicitanteLogin}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, solicitanteLogin: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Matrícula</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Matrícula"
              value={formFilters.matricula}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, matricula: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Tipo de solicitação</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formFilters.tipoId}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, tipoId: e.target.value }))}
            >
              <option value="">Todos</option>
              {tipos.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.codigo ? `${tipo.codigo} - ${tipo.nome}` : tipo.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Setor responsável</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formFilters.departmentId}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, departmentId: e.target.value }))}
            >
              <option value="">Todos</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Centro de custo</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formFilters.costCenterId}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, costCenterId: e.target.value }))}
            >
              <option value="">Todos</option>
              {costCenters.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.externalCode ?? center.code ?? '-'} - {center.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Responsável atual / atendente</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nome do atendente"
              value={formFilters.responsavel}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, responsavel: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Status do chamado</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formFilters.status}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'ALL'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Situação</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formFilters.situacao}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, situacao: e.target.value }))}
            >
              {SITUACAO_OPTIONS.map((option) => (
                <option key={option.value || 'ALL'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Data de abertura</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formFilters.openedDate}
              onChange={(e) =>
                setFormFilters((prev) => ({
                  ...prev,
                  openedDate: e.target.value,
                  openedStart: e.target.value ? '' : prev.openedStart,
                  openedEnd: e.target.value ? '' : prev.openedEnd,
                }))
              }
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Período abertura (inicial)</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formFilters.openedStart}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, openedStart: e.target.value, openedDate: '' }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Período abertura (final)</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formFilters.openedEnd}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, openedEnd: e.target.value, openedDate: '' }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Data de fechamento</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formFilters.closedDate}
              onChange={(e) =>
                setFormFilters((prev) => ({
                  ...prev,
                  closedDate: e.target.value,
                  closedStart: e.target.value ? '' : prev.closedStart,
                  closedEnd: e.target.value ? '' : prev.closedEnd,
                }))
              }
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Período fechamento (inicial)</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formFilters.closedStart}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, closedStart: e.target.value, closedDate: '' }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Período fechamento (final)</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formFilters.closedEnd}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, closedEnd: e.target.value, closedDate: '' }))}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">Texto no formulário</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Buscar por texto..."
              value={formFilters.text}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, text: e.target.value }))}
            />
          </div>
           </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            disabled={loading}
            onClick={() => setFilters((prev) => ({ ...formFilters, page: 1, pageSize: prev.pageSize }))}
          >
            Pesquisar
          </button>

             <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={loading}
            onClick={() => {
              const reset = { ...DEFAULT_FILTERS, pageSize: filters.pageSize }
              setFormFilters(reset)
              setFilters(reset)
            }}
          >
              Limpar filtros
          </button>
          <button
            type="button"
            className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            onClick={exportExcel}
          >
            Exportar Excel
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Solicitações Recebidas</span>
          <div className="flex items-center gap-2">
            {loading && <span className="text-[11px] text-slate-400">Carregando...</span>}
            <button
              type="button"
              onClick={() => selectedRow?.id && window.open(`/solicitacoes/impressao/${selectedRow.id}`, '_blank', 'noopener,noreferrer')}
              disabled={!selectedRow?.id}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer size={12} /> Imprimir selecionado
            </button>
          </div>
        </div>

          {error && <div className="p-4 text-sm text-red-600">{error}</div>}

        <div className="overflow-x-auto">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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
                    <td colSpan={8} className="px-4 py-4 text-center text-sm text-slate-500">
                      Nenhuma solicitação recebida encontrada.
                    </td>
                  </tr>
                )}
    {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    onClick={() => fetchDetail(row)}
                  >
                    <td className="px-4 py-2 text-xs font-semibold">{mapStatusLabel(row.status)}</td>
                    <td className="px-4 py-2 text-xs">{row.protocolo}</td>
                    <td className="px-4 py-2 text-xs">{row.solicitanteNome ?? row.autor?.fullName ?? '-'}</td>
                    <td className="px-4 py-2 text-xs">{row.createdAt ? formatDateDDMMYYYY(row.createdAt) : '-'}</td>
                    <td className="px-4 py-2 text-xs">{row.tipo ? `${row.tipo.codigo} - ${row.tipo.nome}` : row.titulo}</td>
                    <td className="px-4 py-2 text-xs">{row.setorDestino ?? '-'}</td>
                    <td className="px-4 py-2 text-xs">
                      {row.status === 'ABERTA'
                        ? '-'
                        : row.status === 'CONCLUIDA'
                          ? (row.finalizador?.fullName ?? row.responsavel?.fullName ?? '-')
                          : (row.responsavel?.fullName ?? '-')}
                    </td>
                    <td className="px-4 py-2 text-xs font-semibold">
                      {row.nadaConstaStatus === 'PREENCHIDO'
                        ? '✅ Preenchido'
                        : row.nadaConstaStatus === 'PENDENTE'
                          ? '⏳ Pendente'
                          : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2 text-xs text-slate-600">
          <span>
            Mostrando {rangeStart}-{rangeEnd} de {total} solicitações
          </span>

          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-xs text-slate-500">
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
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
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
            <span className="text-xs font-semibold text-slate-600">
              Página {page}/{totalPages}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                }
                disabled={loading || page <= 1}
                className="rounded border border-slate-300 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>

              {paginationItems.map((item, index) => {
                if (item === 'ellipsis') {
                  return (
                    <span key={`ellipsis-${index}`} className="px-2 text-xs text-slate-400">
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
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
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
                className="rounded border border-slate-300 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
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
