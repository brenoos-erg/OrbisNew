'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Filter, RefreshCcw, Search, Plus, Info, Copy, Eraser, Printer } from 'lucide-react'
import { format } from 'date-fns'
import { formatDateDDMMYYYY } from '@/lib/date'
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
import { useSessionMe } from '@/components/session/SessionProvider'
import { getStatusPresentation } from '@/lib/solicitationStatusPresentation'

export const dynamic = 'force-dynamic'

type ApiResponse = { rows: Row[]; total: number }
type DepartmentOption = { id: string; label: string; description?: string | null }
type CostCenterOption = { id: string; description: string; code?: string | null; externalCode?: string | null }
type TipoOption = { id: string; nome: string }

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
  const { data: sessionData, loading: sessionLoading, refresh: refreshSession } = useSessionMe()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([])
  const [tipos, setTipos] = useState<TipoOption[]>([])

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
  const [sessionExpired, setSessionExpired] = useState(false)
  const [sessionExpiredToastShown, setSessionExpiredToastShown] = useState(false)
  const sessionExpiredToastShownRef = useRef(false)

  const applyingFromUrlRef = useRef(false)
  const syncedQueryRef = useRef('')

  const departmentsLabel = useMemo(() => [{ id: '', label: 'Todos os departamentos' }, ...departments], [departments])
  const costCentersLabel = useMemo(() => [{ id: '', description: 'Todos os centros de custo' }, ...costCenters], [costCenters])
  const tiposLabel = useMemo(() => [{ id: '', nome: 'Todos os tipos' }, ...tipos], [tipos])
  const categorias = useMemo(() => [{ id: '', nome: 'Selecione uma opção' }, { id: 'padrao', nome: 'Padrão' }], [])
  const statuses = useMemo(() => [
    { id: '', nome: 'Todos' },
    ...['ABERTA', 'AGUARDANDO_APROVACAO', 'EM_ATENDIMENTO', 'AGUARDANDO_TERMO', 'CONCLUIDA', 'CANCELADA'].map((status) => ({
      id: status,
      nome: getStatusPresentation(status).label,
    })),
  ], [])

  const currentSearchState = useMemo<SearchState>(() => ({ ...appliedFilters, page, pageSize }), [appliedFilters, page, pageSize])

  const showSessionExpiredToastOnce = useCallback(() => {
    if (sessionExpiredToastShownRef.current) return
    if (sessionExpiredToastShown) return

    sessionExpiredToastShownRef.current = true
    setSessionExpiredToastShown(true)
    pushToast('Sua sessão expirou. Faça login novamente.', 'error')
  }, [pushToast, sessionExpiredToastShown])

  const expireSessionLocally = useCallback((showToast = true) => {
    setSessionExpired(true)
    setData([])
    setTotal(0)
    if (showToast === true) showSessionExpiredToastOnce()
  }, [showSessionExpiredToastOnce])

  useEffect(() => {
    if (sessionLoading) return
    if (sessionExpired) return
    if (sessionData?.appUser) return

    expireSessionLocally(true)
  }, [expireSessionLocally, sessionData?.appUser, sessionExpired, sessionLoading])

  const load = useCallback(async (state: SearchState) => {
    if (sessionLoading) return
    if (sessionExpired) return
    if (!sessionData?.appUser) {
      expireSessionLocally(true)
      return
    }

    setLoading(true)
    try {
      const qs = buildQueryFromState(state, true)
      const res = await fetch(`/api/solicitacoes?${qs.toString()}`, { cache: 'no-store' })
      if (res.status === 401) {
        setSessionExpired(true)
        await refreshSession({ force: true })
        setData([])
        setTotal(0)
        showSessionExpiredToastOnce()
        return
      }
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
  }, [expireSessionLocally, pushToast, refreshSession, sessionData?.appUser, sessionExpired, sessionLoading, showSessionExpiredToastOnce])

  useEffect(() => {
    if (sessionLoading) return
    if (sessionExpired) return
    if (!sessionData?.appUser) return

    let active = true
    const controller = new AbortController()

    const loadFilters = async () => {
      try {
      const [departmentsRes, costCentersRes, tiposRes] = await Promise.all([
          fetch('/api/departments', { signal: controller.signal }),
          fetch('/api/cost-centers/select', { signal: controller.signal }),
          fetch('/api/tipos-solicitacao', { signal: controller.signal }),
        ])

        if (!departmentsRes.ok || !costCentersRes.ok || !tiposRes.ok) throw new Error('Erro ao carregar filtros.')
        const departmentsData = (await departmentsRes.json()) as DepartmentOption[]
        const costCentersData = (await costCentersRes.json()) as CostCenterOption[]
        const tiposData = (await tiposRes.json()) as TipoOption[]
        if (active) {
          setDepartments(Array.isArray(departmentsData) ? departmentsData : [])
          setCostCenters(Array.isArray(costCentersData) ? costCentersData : [])
          setTipos(Array.isArray(tiposData) ? tiposData : [])
        }
      } catch (err) {
        if (!controller.signal.aborted && active) {
          console.error('Erro ao carregar filtros de solicitações', err)
          setDepartments([])
          setCostCenters([])
          setTipos([])
        }
      }
    }

    loadFilters()
    return () => {
      active = false
      controller.abort()
    }
  }, [sessionData?.appUser, sessionExpired, sessionLoading])
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
    if (sessionLoading) return
    if (sessionExpired) return
    if (!sessionData?.appUser) {
      expireSessionLocally(false)
      return
    }

    load(currentSearchState)
  }, [currentSearchState, expireSessionLocally, load, sessionData?.appUser, sessionExpired, sessionLoading])

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
    const header = ['Status', 'Protocolo', 'Data Abertura', 'Solicitação', 'SLA', 'Departamento responsável', 'Atendente']
    const rows = data.map((r) => {
      const atendente =
        r.status === 'CONCLUIDA'
          ? (r.finalizador?.fullName ?? r.responsavel?.fullName ?? '')
          : (r.responsavel?.fullName ?? '')

      return [
        getStatusPresentation(r.status).label,
        r.protocolo ?? '',
        r.createdAt ? formatDateDDMMYYYY(r.createdAt) : '',
        r.titulo ?? r.tipo?.nome ?? '',
        r.sla ?? '',
        r.setorDestino ?? '',
        atendente,
      ]
    })
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

  const onPrint = () => {
    if (!selectedRow?.id) {
      pushToast('Selecione uma solicitação na tabela', 'info')
      return
    }
    window.open(`/solicitacoes/impressao/${selectedRow.id}`, '_blank', 'noopener,noreferrer')
  }


  return (
    <div className="app-page">
      <SolicitacoesToastViewport toasts={toasts} onClose={removeToast} />

      <div className="app-page-header justify-between">
        <div>
          <h1 className="app-title text-xl md:text-2xl">Solicitações Enviadas</h1>
          <p className="app-subtitle">Acompanhe o andamento das solicitações que você abriu.</p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <button onClick={onSearch} className="app-button-secondary w-full sm:w-auto">
            <Filter size={16} /> Pesquisar
          </button>

          <button onClick={onClear} className="app-button-secondary w-full sm:w-auto">
            <Eraser size={16} /> Limpar
          </button>

          <button onClick={() => router.push('/dashboard/solicitacoes/enviadas/nova')} className="app-button-primary w-full sm:w-auto">
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
            className="app-button-secondary w-full sm:w-auto"
          >
            <Info size={16} /> Detalhes
          </button>

          <button
            onClick={onPrint}
            className="app-button-secondary w-full sm:w-auto"
          >
            <Printer size={16} /> Imprimir
          </button>

          <button
            disabled
            title="Disponível apenas para a equipe responsável"
            className="app-button-danger w-full sm:w-auto"
          >
            Cancelar
          </button>

          <button onClick={exportCsv} className="app-button-secondary w-full sm:w-auto">
            <Download size={16} /> Excel
          </button>

          <button onClick={() => load(currentSearchState)} className="app-button-primary w-full sm:w-auto">
            <RefreshCcw size={16} /> Atualizar

          </button>
          <label className="inline-flex items-center gap-2 text-xs app-muted-text">
            <input type="checkbox" checked={isAutoRefreshEnabled} onChange={(e) => setIsAutoRefreshEnabled(e.target.checked)} />
            Auto-atualizar (60s)
          </label>

          <span className="text-xs app-muted-text">
            {lastUpdatedAt ? `Atualizado agora (${format(lastUpdatedAt, 'HH:mm:ss')})` : 'Ainda não atualizado'}
          </span>
         </div>
      </div>

      <div className="app-filter-bar">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="app-label">Departamento</label>
            <select value={formFilters.departmentId} onChange={(e) => setFormFilters((prev) => ({ ...prev, departmentId: e.target.value }))} className="app-select mt-1 py-2.5 text-[15px]">
              {departmentsLabel.map((d) => <option key={d.id} value={d.id}>{d.description ? `${d.description} - ${d.label}` : d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="app-label">Centro de Custo</label>
            <select value={formFilters.costCenterId} onChange={(e) => setFormFilters((prev) => ({ ...prev, costCenterId: e.target.value }))} className="app-select mt-1 py-2.5 text-[15px]">
              {costCentersLabel.map((c) => <option key={c.id} value={c.id}>{formatCostCenterLabel(c)}</option>)}

            </select>
          </div>
          <div>
            <label className="app-label">Data Inicial</label>
            <input type="date" value={formFilters.dateStart} onChange={(e) => setFormFilters((prev) => ({ ...prev, dateStart: e.target.value }))} className="app-input mt-1 py-2.5 text-[15px]" />
          </div>
          <div>
            <label className="app-label">Data Final</label>
            <input type="date" value={formFilters.dateEnd} onChange={(e) => setFormFilters((prev) => ({ ...prev, dateEnd: e.target.value }))} className="app-input mt-1 py-2.5 text-[15px]" />
          </div>
          <div>
            <label className="app-label">Solicitação</label>
            <select value={formFilters.tipoId} onChange={(e) => setFormFilters((prev) => ({ ...prev, tipoId: e.target.value }))} className="app-select mt-1 py-2.5 text-[15px]">
              {tiposLabel.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="app-label">Categoria</label>
            <select value={formFilters.categoriaId} onChange={(e) => setFormFilters((prev) => ({ ...prev, categoriaId: e.target.value }))} className="app-select mt-1 py-2.5 text-[15px]">
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="app-label">Protocolo</label>
            <input value={formFilters.protocolo} onChange={(e) => setFormFilters((prev) => ({ ...prev, protocolo: e.target.value }))} className="app-input mt-1 py-2.5 text-[15px]" placeholder="Código do protocolo" />
          </div>
          <div>
            <label className="app-label">Solicitante</label>
            <input value={formFilters.solicitante} onChange={(e) => setFormFilters((prev) => ({ ...prev, solicitante: e.target.value }))} className="app-input mt-1 py-2.5 text-[15px]" placeholder="nome ou e-mail" />
          </div>
          <div>
            <label className="app-label">Status</label>
            <select value={formFilters.status} onChange={(e) => setFormFilters((prev) => ({ ...prev, status: e.target.value }))} className="app-select mt-1 py-2.5 text-[15px]">
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="app-label">Texto no Formulário</label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 app-muted-text" />
              <input value={formFilters.text} onChange={(e) => setFormFilters((prev) => ({ ...prev, text: e.target.value }))} placeholder="Buscar por texto..." className="app-input pl-9 text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="app-table-wrapper">
        <div className="overflow-x-auto">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="app-table-header sticky top-0">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                 <th>Status</th><th>Protocolo</th><th>Data Abertura</th><th>Solicitação</th><th>SLA</th><th>Departamento responsável</th><th>Atendente</th>
                </tr>
              </thead>
              <tbody>
                {loading && <TableSkeletonRows columns={7} rows={5} />}
                {!loading && data.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center app-muted-text">Nenhuma solicitação encontrada</td></tr>}
                {!loading && data.map((r) => (
                  <tr key={r.id} className={`app-table-row cursor-pointer ${selectedRow?.id === r.id ? 'app-table-row-selected' : ''}`} onClick={() => openDetail(r)}>
                    <td className="px-3 py-2"><SolicitationStatusBadge status={r.status} /></td>
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-1">
                        <span>{r.protocolo ?? '-'}</span>
                        {r.protocolo && <button type="button" onClick={(e) => { e.stopPropagation(); onCopyProtocol(r.protocolo) }} className="app-button-ghost rounded p-1"><Copy size={13} /></button>}
                      </div>
                    </td>
                    <td className="px-3 py-2">{r.createdAt ? formatDateDDMMYYYY(r.createdAt) : '-'}</td>
                    <td className="px-3 py-2">{r.titulo ?? r.tipo?.nome ?? '-'}</td>
                    <td className="px-3 py-2">{r.sla ?? '-'}</td>
                    <td className="px-3 py-2">{r.setorDestino ?? '-'}</td>
                    <td className="px-3 py-2">
                      {r.status === 'CONCLUIDA'
                        ? (r.finalizador?.fullName ?? r.responsavel?.fullName ?? '-')
                        : (r.responsavel?.fullName ?? '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="app-muted-text">Mostrar</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="app-select !w-auto py-1">
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="app-muted-text">linhas</span>
          </div>

          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="app-button-secondary px-3 py-1.5">Anterior</button>
            <span className="min-w-[60px] text-center app-muted-text">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="app-button-secondary px-3 py-1.5">Seguinte</button>
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
