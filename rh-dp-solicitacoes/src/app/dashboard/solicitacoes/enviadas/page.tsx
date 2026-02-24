'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Filter, RefreshCcw, Search, Plus, Info, Copy, Eraser } from 'lucide-react'
import { format } from 'date-fns'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Row,
  SolicitationDetail,
  SolicitationDetailModal,
} from '@/components/solicitacoes/SolicitationDetailModal'
import { formatCostCenterLabel } from '@/lib/costCenter'
import { SolicitationStatusBadge } from '@/components/solicitacoes/SolicitationStatusBadge'
import { TableSkeletonRows } from '@/components/solicitacoes/TableSkeletonRows'
import { SolicitacoesToastViewport, useSolicitacoesToast } from '@/components/solicitacoes/SolicitacoesToast'

export const dynamic = 'force-dynamic'

type ApiResponse = { rows: Row[]; total: number }
type DepartmentOption = { id: string; label: string; description?: string | null }
type CostCenterOption = { id: string; description: string; code?: string | null; externalCode?: string | null }

type FilterState = {
  departmentId: string
  dateStart: string
  dateEnd: string
  costCenterId: string
  tipoId: string
  categoriaId: string
  protocolo: string
  solicitante: string
  status: string
  text: string
}


type SearchState = FilterState & { page: number; pageSize: number }

const PAGE_SIZE_OPTIONS = [10, 25, 50]
const DEFAULT_FILTERS: FilterState = {
  departmentId: '',
  dateStart: '',
  dateEnd: '',
  costCenterId: '',
  tipoId: '',
  categoriaId: '',
  protocolo: '',
  solicitante: '',
  status: '',
  text: '',
}

function escapeCsv(v: string) {
  if (v == null) return ''
  if (/[;"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function stateFromSearchParams(searchParams: URLSearchParams): SearchState {
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 10)
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : 10,
    departmentId: searchParams.get('departmentId') ?? '',
    dateStart: searchParams.get('dateStart') ?? '',
    dateEnd: searchParams.get('dateEnd') ?? '',
    costCenterId: searchParams.get('costCenterId') ?? '',
    tipoId: searchParams.get('tipoId') ?? '',
    categoriaId: searchParams.get('categoriaId') ?? '',
    protocolo: searchParams.get('protocolo') ?? '',
    solicitante: searchParams.get('solicitante') ?? '',
    status: searchParams.get('status') ?? '',
    text: searchParams.get('text') ?? '',
  }
}


function buildQueryFromState(state: SearchState, includeScope = false) {
  const qs = new URLSearchParams()
  qs.set('page', String(state.page))
  qs.set('pageSize', String(state.pageSize))
  if (includeScope) qs.set('scope', 'sent')
  const keys: (keyof FilterState)[] = [
    'departmentId',
    'dateStart',
    'dateEnd',
    'costCenterId',
    'tipoId',
    'categoriaId',
    'protocolo',
    'solicitante',
    'status',
    'text',
  ]

  for (const key of keys) {
    const value = state[key]
    if (value) qs.set(key, value)
  }

  return qs
}

export default function SentRequestsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toasts, pushToast, removeToast } = useSolicitacoesToast()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([])

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [formFilters, setFormFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(false)
  const [selectedRow, setSelectedRow] = useState<Row | null>(null)
  const [detail, setDetail] = useState<SolicitationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const applyingFromUrlRef = useRef(false)
  const syncedQueryRef = useRef('')

  const departmentsLabel = useMemo(() => [{ id: '', label: 'Todos os departamentos' }, ...departments], [departments])
  const costCentersLabel = useMemo(() => [{ id: '', description: 'Todos os centros de custo' }, ...costCenters], [costCenters])
  const tipos = useMemo(() => [{ id: '', nome: 'Selecione uma opção' }, { id: 'tipo-docs-1', nome: 'Abertura de Chamado' }], [])
  const categorias = useMemo(() => [{ id: '', nome: 'Selecione uma opção' }, { id: 'padrao', nome: 'Padrão' }], [])
  const statuses = useMemo(() => [
    { id: '', nome: 'Todos' },
    { id: 'ABERTA', nome: 'ABERTA' },
    { id: 'AGUARDANDO_APROVACAO', nome: 'AGUARDANDO_APROVACAO' },
    { id: 'EM_ATENDIMENTO', nome: 'EM_ATENDIMENTO' },
    { id: 'AGUARDANDO_TERMO', nome: 'AGUARDANDO_TERMO' },
    { id: 'CONCLUIDA', nome: 'CONCLUIDA' },
    { id: 'CANCELADA', nome: 'CANCELADA' },
  ], [])

  const currentSearchState = useMemo<SearchState>(() => ({ ...appliedFilters, page, pageSize }), [appliedFilters, page, pageSize])

  const load = useCallback(async (state: SearchState) => {
    setLoading(true)
    try {
      const qs = buildQueryFromState(state, true)
      const res = await fetch(`/api/solicitacoes?${qs.toString()}`, { cache: 'no-store' })
      const json: ApiResponse = await res.json()
      setData(json.rows)
      setTotal(json.total)
      setLastUpdatedAt(new Date())
    } catch (e) {
      console.error('load sent requests error', e)
      pushToast('Não foi possível atualizar a lista.', 'error')
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    const loadFilters = async () => {
      try {
        const [departmentsRes, costCentersRes] = await Promise.all([
          fetch('/api/departments', { signal: controller.signal }),
          fetch('/api/cost-centers/select', { signal: controller.signal }),
        ])

        if (!departmentsRes.ok || !costCentersRes.ok) throw new Error('Erro ao carregar filtros.')
        const departmentsData = (await departmentsRes.json()) as DepartmentOption[]
        const costCentersData = (await costCentersRes.json()) as CostCenterOption[]
        if (active) {
          setDepartments(Array.isArray(departmentsData) ? departmentsData : [])
          setCostCenters(Array.isArray(costCentersData) ? costCentersData : [])
        }
      } catch (err) {
        if (!controller.signal.aborted && active) {
          console.error('Erro ao carregar filtros de solicitações', err)
          setDepartments([])
          setCostCenters([])
        }
      }
    }

    loadFilters()
    return () => {
      active = false
      controller.abort()
    }
  }, [])
  useEffect(() => {
    const raw = searchParams.toString()
    if (raw === syncedQueryRef.current) return

    applyingFromUrlRef.current = true
    const parsed = stateFromSearchParams(new URLSearchParams(raw))
    setPage(parsed.page)
    setPageSize(parsed.pageSize)
    const parsedFilters: FilterState = {
      departmentId: parsed.departmentId,
      dateStart: parsed.dateStart,
      dateEnd: parsed.dateEnd,
      costCenterId: parsed.costCenterId,
      tipoId: parsed.tipoId,
      categoriaId: parsed.categoriaId,
      protocolo: parsed.protocolo,
      solicitante: parsed.solicitante,
      status: parsed.status,
      text: parsed.text,
    }
    setFormFilters(parsedFilters)
    setAppliedFilters(parsedFilters)
    syncedQueryRef.current = raw
    applyingFromUrlRef.current = false
  }, [searchParams])

  useEffect(() => {
    const qs = buildQueryFromState(currentSearchState).toString()
    if (applyingFromUrlRef.current || qs === syncedQueryRef.current) return
    syncedQueryRef.current = qs
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [currentSearchState, pathname, router])

  useEffect(() => {
    load(currentSearchState)
  }, [currentSearchState, load])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAppliedFilters((prev) => {
        if (
          prev.protocolo === formFilters.protocolo &&
          prev.solicitante === formFilters.solicitante &&
          prev.text === formFilters.text
        ) {
          return prev
        }
        setPage(1)
        return {
          ...prev,
          protocolo: formFilters.protocolo,
          solicitante: formFilters.solicitante,
          text: formFilters.text,
        }
      })
    }, 400)

    return () => clearTimeout(timeout)
  }, [formFilters.protocolo, formFilters.solicitante, formFilters.text])
  useEffect(() => {
    if (!isAutoRefreshEnabled) return
    const interval = window.setInterval(() => {
      if (detailOpen || document.visibilityState !== 'visible') return
      load(currentSearchState)
    }, 60000)

    return () => clearInterval(interval)
  }, [isAutoRefreshEnabled, detailOpen, currentSearchState, load])

  const onSearch = () => {
    setPage(1)
    setAppliedFilters((prev) => ({
      ...prev,
      departmentId: formFilters.departmentId,
      dateStart: formFilters.dateStart,
      dateEnd: formFilters.dateEnd,
      costCenterId: formFilters.costCenterId,
      tipoId: formFilters.tipoId,
      categoriaId: formFilters.categoriaId,
      status: formFilters.status,
    }))
  }

  const onClear = () => {
    setFormFilters(DEFAULT_FILTERS)
    setAppliedFilters(DEFAULT_FILTERS)
    setPage(1)
    setPageSize(10)
  }

  const exportCsv = () => {
    const header = ['Status', 'Protocolo', 'Data Abertura', 'Solicitação', 'SLA', 'Centro Responsável', 'Atendente']
    const rows = data.map((r) => [
      r.status ?? '',
      r.protocolo ?? '',
      r.createdAt ? format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm') : '',
      r.titulo ?? r.tipo?.nome ?? '',
      r.sla ?? '',
      r.setorDestino ?? '',
      r.responsavel?.fullName ?? '',
    ])
    const csv = [header, ...rows].map((l) => l.map(escapeCsv).join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'solicitacoes-enviadas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const openDetail = async (row: Row) => {
    setSelectedRow(row)
    setDetailOpen(true)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)

    try {
     const [res, timelineRes] = await Promise.all([
        fetch(`/api/solicitacoes/${row.id}`, { cache: 'no-store' }),
        fetch(`/api/solicitacoes/${row.id}/timeline`, { cache: 'no-store' }),
      ])
      if (!res.ok) throw new Error('Erro ao carregar detalhes da solicitação.')
      const json = (await res.json()) as SolicitationDetail
      const timelineJson = timelineRes.ok ? await timelineRes.json() : []
      setDetail({ ...json, timelines: Array.isArray(timelineJson) ? timelineJson : json.timelines })
    } catch (e: any) {
      console.error('Erro ao buscar detalhe da solicitação', e)
      setDetailError(e?.message ?? 'Erro ao carregar detalhes.')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setSelectedRow(null)
    setDetail(null)
    setDetailError(null)
  }

  const onCopyProtocol = async (protocol?: string | null) => {
    if (!protocol) return
    await navigator.clipboard.writeText(protocol)
    pushToast('Copiado', 'success')
  }


  return (
    <div className="space-y-4">
      <SolicitacoesToastViewport toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Solicitações Enviadas</h1>
          <p className="text-sm text-slate-500">Acompanhe o andamento das solicitações que você abriu.</p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <button onClick={onSearch} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:w-auto">
            <Filter size={16} /> Pesquisar
          </button>

          <button onClick={onClear} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:w-auto">
            <Eraser size={16} /> Limpar
          </button>

          <button onClick={() => router.push('/dashboard/solicitacoes/enviadas/nova')} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm text-white hover:bg-orange-500 sm:w-auto">
            <Plus size={16} /> Nova Solicitação
          </button>

          <button
            onClick={() => {
              if (!selectedRow) {
                pushToast('Selecione uma solicitação na tabela', 'info')
                return
               }
              openDetail(selectedRow)
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            <Info size={16} /> Detalhes
          </button>

          <button
            disabled
            title="Disponível apenas para a equipe responsável"
            className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-400 sm:w-auto"
          >
            Cancelar
          </button>

          <button onClick={exportCsv} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:w-auto">
            <Download size={16} /> Excel
          </button>

          <button onClick={() => load(currentSearchState)} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 sm:w-auto">
            <RefreshCcw size={16} /> Atualizar

          </button>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={isAutoRefreshEnabled} onChange={(e) => setIsAutoRefreshEnabled(e.target.checked)} />
            Auto-atualizar (60s)
          </label>

          <span className="text-xs text-slate-500">
            {lastUpdatedAt ? `Atualizado agora (${format(lastUpdatedAt, 'HH:mm:ss')})` : 'Ainda não atualizado'}
          </span>
         </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">Departamento</label>
            <select value={formFilters.departmentId} onChange={(e) => setFormFilters((prev) => ({ ...prev, departmentId: e.target.value }))} className="mt-1 w-full rounded-md border border-blue-600 py-2.5 text-[15px]">
              {departmentsLabel.map((d) => <option key={d.id} value={d.id}>{d.description ? `${d.description} - ${d.label}` : d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">Centro de Custo</label>
            <select value={formFilters.costCenterId} onChange={(e) => setFormFilters((prev) => ({ ...prev, costCenterId: e.target.value }))} className="mt-1 w-full rounded-md border border-blue-600 py-2.5 text-[15px]">
              {costCentersLabel.map((c) => <option key={c.id} value={c.id}>{formatCostCenterLabel(c)}</option>)}

            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">Data Inicial</label>
            <input type="date" value={formFilters.dateStart} onChange={(e) => setFormFilters((prev) => ({ ...prev, dateStart: e.target.value }))} className="mt-1 w-full rounded-md border border-blue-600 py-2.5 text-[15px]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">Data Final</label>
            <input type="date" value={formFilters.dateEnd} onChange={(e) => setFormFilters((prev) => ({ ...prev, dateEnd: e.target.value }))} className="mt-1 w-full rounded-md border border-blue-600 py-2.5 text-[15px]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">Solicitação</label>
            <select value={formFilters.tipoId} onChange={(e) => setFormFilters((prev) => ({ ...prev, tipoId: e.target.value }))} className="mt-1 w-full rounded-md border border-blue-600 py-2.5 text-[15px]">
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">Categoria</label>
            <select value={formFilters.categoriaId} onChange={(e) => setFormFilters((prev) => ({ ...prev, categoriaId: e.target.value }))} className="mt-1 w-full rounded-md border border-blue-600 py-2.5 text-[15px]">
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">Protocolo</label>
            <input value={formFilters.protocolo} onChange={(e) => setFormFilters((prev) => ({ ...prev, protocolo: e.target.value }))} className="mt-1 w-full rounded-md border border-blue-600 py-2.5 text-[15px]" placeholder="Código do protocolo" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">Solicitante</label>
            <input value={formFilters.solicitante} onChange={(e) => setFormFilters((prev) => ({ ...prev, solicitante: e.target.value }))} className="mt-1 w-full rounded-md border border-blue-600 py-2.5 text-[15px]" placeholder="nome ou e-mail" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">Status</label>
            <select value={formFilters.status} onChange={(e) => setFormFilters((prev) => ({ ...prev, status: e.target.value }))} className="mt-1 w-full rounded-md border border-blue-600 py-2.5 text-[15px]">
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-semibold text-black tracking-wide">Texto no Formulário</label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={formFilters.text} onChange={(e) => setFormFilters((prev) => ({ ...prev, text: e.target.value }))} placeholder="Buscar por texto..." className="w-full rounded-md border-slate-300 pl-9 text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                  <th>Status</th><th>Protocolo</th><th>Data Abertura</th><th>Solicitação</th><th>SLA</th><th>Centro Responsável</th><th>Atendente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && <TableSkeletonRows columns={7} rows={5} />}
                {!loading && data.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Nenhuma solicitação encontrada</td></tr>}
                {!loading && data.map((r) => (
                  <tr key={r.id} className={`cursor-pointer hover:bg-slate-50 ${selectedRow?.id === r.id ? 'bg-slate-50' : ''}`} onClick={() => openDetail(r)}>
                    <td className="px-3 py-2"><SolicitationStatusBadge status={r.status} /></td>
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-1">
                        <span>{r.protocolo ?? '-'}</span>
                        {r.protocolo && <button type="button" onClick={(e) => { e.stopPropagation(); onCopyProtocol(r.protocolo) }} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"><Copy size={13} /></button>}
                      </div>
                    </td>
                    <td className="px-3 py-2">{r.createdAt ? format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm') : '-'}</td>
                    <td className="px-3 py-2">{r.titulo ?? r.tipo?.nome ?? '-'}</td>
                    <td className="px-3 py-2">{r.sla ?? '-'}</td>
                    <td className="px-3 py-2">{r.setorDestino ?? '-'}</td>
                    <td className="px-3 py-2">{r.responsavel?.fullName ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Mostrar</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="rounded-md border-slate-300">
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-slate-600">linhas</span>
          </div>

          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 enabled:hover:bg-slate-50 disabled:opacity-40">Anterior</button>
            <span className="min-w-[60px] text-center text-slate-600">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 enabled:hover:bg-slate-50 disabled:opacity-40">Seguinte</button>
          </div>
        </div>
      </div>

      <SolicitationDetailModal
        isOpen={detailOpen}
        onClose={closeDetail}
        row={selectedRow}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        canManage={false}
      />
    </div>
  )
} 