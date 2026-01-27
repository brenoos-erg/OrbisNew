// src/app/dashboard/solicitacoes/enviadas/page.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Download, Filter, RefreshCcw, Search, Plus, Info, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import {
  Row,
  SolicitationDetail,
  SolicitationDetailModal,
} from '@/components/solicitacoes/SolicitationDetailModal'
export const dynamic = 'force-dynamic'

type ApiResponse = {
  rows: Row[]
  total: number
}
type DepartmentOption = {
  id: string
  label: string
  description?: string | null
}

type CostCenterOption = {
  id: string
  description: string
  code?: string | null
}


/** ===== CONSTANTES ===== */

const PAGE_SIZE_OPTIONS = [10, 25, 50]

function escapeCsv(v: string) {
  if (v == null) return ''
  if (/[;"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}


/** =========================================
 *  PÁGINA
 * ======================================= */

export default function SentRequestsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([])

  // paginação
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // filtros
  const [departmentId, setDepartmentId] = useState<string>('')
  const [dateStart, setDateStart] = useState<string>('')
  const [dateEnd, setDateEnd] = useState<string>('')
  const [costCenterId, setCostCenterId] = useState<string>('') // centro responsável
  const [tipoId, setTipoId] = useState<string>('') // solicitação (tipo)
  const [categoriaId, setCategoriaId] = useState<string>('') // se usar categoria
  const [protocolo, setProtocolo] = useState<string>('')
  const [solicitante, setSolicitante] = useState<string>('') // nome ou email
  const [status, setStatus] = useState<string>('')
  const [text, setText] = useState<string>('') // texto no formulário

  // ===== DETALHE =====
  const [selectedRow, setSelectedRow] = useState<Row | null>(null)
  const [detail, setDetail] = useState<SolicitationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

   const departmentsLabel = useMemo(() => {
    return [{ id: '', label: 'Selecione um departamento' }, ...departments]
  }, [departments])

  const costCentersLabel = useMemo(() => {
    return [
      { id: '', description: 'Todos os centros de custo' },
      ...costCenters,
    ]
  }, [costCenters])
  const tipos = useMemo(
    () => [
      { id: '', nome: 'Selecione uma opção' },
      { id: 'tipo-docs-1', nome: 'Abertura de Chamado' },
    ],
    [],
  )
  const categorias = useMemo(
    () => [
      { id: '', nome: 'Selecione uma opção' },
      { id: 'padrao', nome: 'Padrão' },
    ],
    [],
  )
  const statuses = useMemo(
    () => [
      { id: '', nome: 'Todos' },
      { id: 'ABERTA', nome: 'ABERTA' },
      { id: 'AGUARDANDO_APROVACAO', nome: 'AGUARDANDO_APROVACAO' },
      { id: 'EM_ATENDIMENTO', nome: 'EM_ATENDIMENTO' },
      { id: 'CONCLUIDA', nome: 'CONCLUIDA' },
      { id: 'CANCELADA', nome: 'CANCELADA' },
    ],
    [],
  )
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const loadFilters = async () => {
      try {
        const [departmentsRes, costCentersRes] = await Promise.all([
          fetch('/api/departments', { signal: controller.signal }),
          fetch('/api/cost-centers/select', { signal: controller.signal }),
        ])

        if (!departmentsRes.ok || !costCentersRes.ok) {
          throw new Error('Erro ao carregar filtros.')
        }

        const departmentsData =
          (await departmentsRes.json()) as DepartmentOption[]
        const costCentersData =
          (await costCentersRes.json()) as CostCenterOption[]

        if (active) {
          setDepartments(Array.isArray(departmentsData) ? departmentsData : [])
          setCostCenters(
            Array.isArray(costCentersData) ? costCentersData : [],
          )
        }
      } catch (err) {
        console.error('Erro ao carregar filtros de solicitações', err)
        if (active) {
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


 function buildQuery() {
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('pageSize', String(pageSize))
    // neste módulo usamos sempre as ENVIADAS pelo usuário logado
    qs.set('scope', 'sent')
    qs.set('departmentId', departmentId)
    if (dateStart) qs.set('dateStart', dateStart)
    if (dateEnd) qs.set('dateEnd', dateEnd)
    if (costCenterId) qs.set('costCenterId', costCenterId)
    if (tipoId) qs.set('tipoId', tipoId)
    if (categoriaId) qs.set('categoriaId', categoriaId)
    if (protocolo) qs.set('protocolo', protocolo)
    if (solicitante) qs.set('solicitante', solicitante)
    if (status) qs.set('status', status)
    if (text) qs.set('text', text)
    return qs.toString()
  }

  async function load() {
    if (!departmentId) {
      setData([])
      setTotal(0)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const qs = buildQuery()
      const res = await fetch(`/api/solicitacoes?${qs}`, { cache: 'no-store' })
      const json: ApiResponse = await res.json()
      setData(json.rows)
      setTotal(json.total)
    } catch (e) {
      console.error('load sent requests error', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    pageSize,
    departmentId,
    dateStart,
    dateEnd,
    costCenterId,
    tipoId,
    categoriaId,
    protocolo,
    solicitante,
    status,
    text,
  ])

  function onSearch() {
    setPage(1)
    load()
  }

  function exportCsv() {
    const header = [
      'Status',
      'Protocolo',
      'Data Abertura',
      'Solicitação',
      'SLA',
      'Centro Responsável',
      'Atendente',
    ]
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
  const missingDepartment = !departmentId

  /** ===== DETALHE ===== */

  async function openDetail(row: Row) {
    setSelectedRow(row)
    setDetailOpen(true)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)

    try {
      const res = await fetch(`/api/solicitacoes/${row.id}`, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error('Erro ao carregar detalhes da solicitação.')
      }
      const json = (await res.json()) as SolicitationDetail
      setDetail(json)
    } catch (e: any) {
      console.error('Erro ao buscar detalhe da solicitação', e)
      setDetailError(e?.message ?? 'Erro ao carregar detalhes.')
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setDetailOpen(false)
    setSelectedRow(null)
    setDetail(null)
    setDetailError(null)
  }


  return (
    <div className="space-y-4">
      {/* Título + Ações */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Solicitações Enviadas</h1>
          <p className="text-sm text-slate-500">
            Acompanhe o andamento das solicitações que você abriu. Esta tela é apenas
            para consulta: assumir ou finalizar o chamado deve ser feito pela equipe
            responsável.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <button
            onClick={onSearch}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:w-auto"
            title="Pesquisar"
          >
            <Filter size={16} />
            Pesquisar
          </button>

          <button
            onClick={() => router.push('/dashboard/solicitacoes/enviadas/nova')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm text-white hover:bg-orange-500 sm:w-auto"
            title="Nova Solicitação"
          >
            <Plus size={16} />
            Nova Solicitação
          </button>

          <button
            onClick={() => {
              if (!selectedRow) {
                alert('Clique em uma solicitação na tabela para ver os detalhes.')
              } else {
                openDetail(selectedRow)
              }
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:w-auto"
            title="Detalhes da Solicitação"
          >
            <Info size={16} />
            Detalhes
          </button>

          <button
            onClick={() => alert('Cancelar a solicitação selecionada')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50 sm:w-auto"
            title="Cancelar Solicitação"
          >
            <XCircle size={16} />
            Cancelar
          </button>

          <button
            onClick={exportCsv}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:w-auto"
            title="Exportar Excel"
          >
            <Download size={16} />
            Excel
          </button>

          <button
            onClick={load}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 sm:w-auto"
            title="Atualizar"
          >
            <RefreshCcw size={16} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">
              Departamento
            </label>
            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value)
                setPage(1)
              }}
              className="mt-1 w-full rounded-md border border-blue-600 text-[15px] py-2.5 shadow-sm transition-all duration-150 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 bg-white"
            >
              {departmentsLabel.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.description ? `${d.description} - ${d.label}` : d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">
              Centro de Custo
            </label>
            <select
              value={costCenterId}
              onChange={(e) => {
                setCostCenterId(e.target.value)
                setPage(1)
              }}
              className="mt-1 w-full rounded-md border border-blue-600 text-[15px] py-2.5 shadow-sm transition-all duration-150 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 bg-white"
            >
              {costCentersLabel.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} - ${c.description}` : c.description}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">
              Data Inicial
            </label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="mt-1 w-full rounded-md border border-blue-600 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">
              Data Fim
            </label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="mt-1 w-full rounded-md border border-blue-600 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">
              Categoria
            </label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="mt-1 w-full rounded-md border border-blue-600 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150"
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">
              Solicitação
            </label>
            <select
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
              className="mt-1 w-full rounded-md border border-blue-600 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150"
            >
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">
              Protocolo
            </label>
            <input
              value={protocolo}
              onChange={(e) => setProtocolo(e.target.value)}
              className="mt-1 w-full rounded-md border border-blue-600 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150"
              placeholder="Código do protocolo"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">
              Solicitante
            </label>
            <input
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              className="mt-1 w-full rounded-md border border-blue-600 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150"
              placeholder="nome ou e-mail"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-black tracking-wide">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-md border border-blue-600 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150"
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-semibold text-black tracking-wide">
              Texto no Formulário
            </label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Buscar por texto..."
                className="w-full rounded-md border-slate-300 pl-9 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela (sem timeline em cima!) */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                  <th>Status</th>
                  <th>Protocolo</th>
                  <th>Data Abertura</th>
                  <th>Solicitação</th>
                  <th>SLA</th>
                  <th>Centro Responsável</th>
                  <th>Atendente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {missingDepartment && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Selecione um departamento para carregar as solicitações.
                    </td>
                  </tr>
                )}
                {loading && !missingDepartment && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!loading && !missingDepartment && data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      Nenhuma solicitação encontrada
                    </td>
                  </tr>
                )}
                {!loading &&
                  !missingDepartment &&
                  data.map((r) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50 cursor-pointer ${
                        selectedRow?.id === r.id ? 'bg-slate-50' : ''
                      }`}
                      onClick={() => openDetail(r)} // 👉 abre o modal com os dados
                    >
                      <td className="px-3 py-2">{r.status}</td>
                      <td className="px-3 py-2">{r.protocolo ?? '-'}</td>
                      <td className="px-3 py-2">
                        {r.createdAt ? format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm') : '-'}
                      </td>
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

        {/* paginação */}
        <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Mostrar</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="rounded-md border-slate-300"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-slate-600">linhas</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 enabled:hover:bg-slate-50 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="min-w-[60px] text-center text-slate-600">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 enabled:hover:bg-slate-50 disabled:opacity-40"
            >
              Seguinte
            </button>
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
        canManage={false}   // aqui bloqueia assumir/finalizar
      />
      

            
    </div>
  )
}
