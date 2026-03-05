// src/app/dashboard/solicitacoes/recebidas/page.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { formatDateDDMMYYYY } from '@/lib/date'
import {
  Row,
  SolicitationDetail,
  SolicitationDetailModal,
} from '@/components/solicitacoes/SolicitationDetailModal'

type FilterState = {
  dateStart?: string
  dateEnd?: string
  centerId?: string
  tipoId?: string
  protocolo?: string
  solicitante?: string
  status?: string
  text?: string
  page: number
  pageSize: number
}

type ListResponse = {
  rows: Row[]
  total: number
}

type PaginationItem = number | 'ellipsis'

function mapStatusLabel(status: string) {
  if (status === 'ABERTA') return 'AGUARDANDO ATENDIMENTO'
  if (status === 'EM_ATENDIMENTO') return 'EM ATENDIMENTO'
  if (status === 'AGUARDANDO_APROVACAO') return 'AGUARD. APROVAÇÃO'
  if (status === 'AGUARDANDO_TERMO') return 'AGUARD. TERMO'
  if (status === 'AGUARDANDO_AVALIACAO_GESTOR') return 'AGUARD. AVALIAÇÃO GESTOR'
  if (status === 'CONCLUIDA') return 'CONCLUÍDA'
  if (status === 'CANCELADA') return 'CANCELADA'
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
  const [filters, setFilters] = useState<FilterState>({
    page: 1,
    pageSize: 10,
  })

  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedRow, setSelectedRow] = useState<Row | null>(null)
  const [detail, setDetail] = useState<SolicitationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
   const [detailMode, setDetailMode] = useState<'default' | 'approval'>(
    'default',
  )

  async function fetchList() {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', String(filters.page))
      params.set('pageSize', String(filters.pageSize))

      if (filters.dateStart) params.set('dateStart', filters.dateStart)
      if (filters.dateEnd) params.set('dateEnd', filters.dateEnd)
      if (filters.centerId) params.set('centerId', filters.centerId)
      if (filters.tipoId) params.set('tipoId', filters.tipoId)
      if (filters.protocolo) params.set('protocolo', filters.protocolo)
      if (filters.solicitante) params.set('solicitante', filters.solicitante)
      if (filters.status) params.set('status', filters.status)
      if (filters.text) params.set('text', filters.text)

      const res = await fetch(
        `/api/solicitacoes/recebidas?${params.toString()}`,
      )
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => null)
        throw new Error(
          errorPayload?.error ?? 'Erro ao buscar solicitações recebidas.',
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

  async function fetchDetail(row: Row) {
    setSelectedRow(row)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    const shouldOpenInApprovalMode =
      row.tipo?.nome === 'RQ_091 - Solicitação de Incentivo à Educação' &&
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

  useEffect(() => {
    fetchList()
    const interval = setInterval(fetchList, 5000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

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

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          Solicitações Recebidas
        </h1>
        <p className="text-sm text-slate-500">
          Visualize e trate as solicitações destinadas aos centros de custo em
          que você está vinculado.
        </p>
      </div>

      {/* Filtros principais */}
      <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Protocolo */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
            Protocolo
          </label>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Código do protocolo"
            value={filters.protocolo ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                protocolo: e.target.value,
                page: 1,
              }))
            }
          />
        </div>

        {/* Solicitante */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
            Solicitante
          </label>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="nome ou e-mail"
            value={filters.solicitante ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                solicitante: e.target.value,
                page: 1,
              }))
            }
          />
        </div>

        {/* Texto livre */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
            Texto no formulário
          </label>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Buscar por texto..."
            value={filters.text ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                text: e.target.value,
                page: 1,
              }))
            }
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Solicitações Recebidas</span>
          {loading && (
            <span className="text-[11px] text-slate-400">Carregando...</span>
          )}
        </div>

        {error && (
          <div className="p-4 text-sm text-red-600">{error}</div>
        )}

       <div className="overflow-x-auto">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                   <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Protocolo</th>
                  <th className="px-4 py-2">Data Abertura</th>
                  <th className="px-4 py-2">Solicitação</th>
                  <th className="px-4 py-2">Departamento responsável</th>
                  <th className="px-4 py-2">Atendente</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-4 text-center text-sm text-slate-500"
                    >
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
                    <td className="px-4 py-2 text-xs font-semibold">
                      {mapStatusLabel(row.status)}
                    </td>
                    <td className="px-4 py-2 text-xs">{row.protocolo}</td>
                    <td className="px-4 py-2 text-xs">
                      {row.createdAt
                         ? formatDateDDMMYYYY(row.createdAt)
                        : '-'}
                     </td>
                    <td className="px-4 py-2 text-xs">
                      {row.tipo ? `${row.tipo.codigo} - ${row.tipo.nome}` : row.titulo}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {row.setorDestino ?? '-'}
                    </td>

                    {/* 🔥 Regras do ATENDENTE:
                        - Se status = ABERTA (AGUARDANDO ATENDIMENTO), nunca mostra atendente
                        - Caso contrário, mostra somente o responsavel se existir */}
                    <td className="px-4 py-2 text-xs">
                      {row.status === 'ABERTA'
                        ? '-'
                        : row.responsavel?.fullName ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rodapé com paginação */}
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

      {/* Modal de detalhes */}
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
