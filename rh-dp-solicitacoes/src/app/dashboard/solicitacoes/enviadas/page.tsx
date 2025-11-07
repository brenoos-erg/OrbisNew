'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Download, Filter, RefreshCcw, Search, Plus, Info, XCircle } from 'lucide-react'
import { format } from 'date-fns'

type Row = {
  id: string
  titulo: string
  status: string
  protocolo?: string
  createdAt: string
  tipo?: { nome: string } | null
  responsavel?: { fullName: string } | null
  responsavelId?: string | null
  autor?: { fullName: string } | null
  sla?: string | null
  setorDestino?: string | null
}

type ApiResponse = {
  rows: Row[]
  total: number
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]

export default function SentRequestsPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Row[]>([])
  const [total, setTotal] = useState(0)

  // paginação
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // filtros
  const [dateStart, setDateStart] = useState<string>('')
  const [dateEnd, setDateEnd] = useState<string>('')
  const [centerId, setCenterId] = useState<string>('') // centro responsável
  const [tipoId, setTipoId] = useState<string>('') // solicitação (tipo)
  const [categoriaId, setCategoriaId] = useState<string>('') // se usar categoria
  const [protocolo, setProtocolo] = useState<string>('')
  const [solicitante, setSolicitante] = useState<string>('') // nome ou email
  const [status, setStatus] = useState<string>('')
  const [text, setText] = useState<string>('') // texto no formulário

  // combos mockados (troque por fetchs reais depois)
  const centros = useMemo(
    () => [
      { id: '', nome: 'Selecione uma opção' },
      { id: 'ti', nome: 'Tecnologia da Informação' },
      { id: 'rh', nome: 'Recursos Humanos' },
    ],
    []
  )
  const tipos = useMemo(
    () => [
      { id: '', nome: 'Selecione uma opção' },
      { id: 'tipo-docs-1', nome: 'Abertura de Chamado' },
    ],
    []
  )
  const categorias = useMemo(
    () => [
      { id: '', nome: 'Selecione uma opção' },
      { id: 'padrao', nome: 'Padrão' },
    ],
    []
  )
  const statuses = useMemo(
    () => [
      { id: '', nome: 'Todos' },
      { id: 'ABERTA', nome: 'ABERTA' },
      { id: 'EM_ANALISE', nome: 'EM_ANALISE' },
      { id: 'AGUARDANDO_INFO', nome: 'AGUARDANDO_INFO' },
      { id: 'APROVADA', nome: 'APROVADA' },
      { id: 'REJEITADA', nome: 'REJEITADA' },
      { id: 'CONCLUIDA', nome: 'CONCLUIDA' },
    ],
    []
  )

  function buildQuery() {
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('pageSize', String(pageSize))
    qs.set('scope', 'sent') // IMPORTANTe: pedimos só as ENVIADAS
    if (dateStart) qs.set('dateStart', dateStart)
    if (dateEnd) qs.set('dateEnd', dateEnd)
    if (centerId) qs.set('centerId', centerId)
    if (tipoId) qs.set('tipoId', tipoId)
    if (categoriaId) qs.set('categoriaId', categoriaId)
    if (protocolo) qs.set('protocolo', protocolo)
    if (solicitante) qs.set('solicitante', solicitante)
    if (status) qs.set('status', status)
    if (text) qs.set('text', text)
    return qs.toString()
  }

  async function load() {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

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

  function escapeCsv(v: string) {
    if (v == null) return ''
    if (/[;"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
    return v
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4">
      {/* Título + Ações */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Solicitações Enviadas</h1>
          <p className="text-sm text-slate-500">
            Visualize e gerencie as solicitações que você abriu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSearch}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            title="Pesquisar"
          >
            <Filter size={16} />
            Pesquisar
          </button>

          <button
            onClick={() => window.location.assign('/dashboard/solicitacoes/enviadas/nova')}
            className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm text-white hover:bg-orange-500"
            title="Nova Solicitação"
          >
            <Plus size={16} />
            Nova Solicitação
          </button>

          <button
            onClick={() => alert('Abra o detalhe da linha selecionada')}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            title="Detalhes da Solicitação"
          >
            <Info size={16} />
            Detalhes
          </button>

          <button
            onClick={() => alert('Cancelar a solicitação selecionada')}
            className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            title="Cancelar Solicitação"
          >
            <XCircle size={16} />
            Cancelar
          </button>

          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            title="Exportar Excel"
          >
            <Download size={16} />
            Excel
          </button>

          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            title="Atualizar"
          >
            <RefreshCcw size={16} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-3">
            <label className="block text-xs font-semibold text-black tracking-wide">Data Inicial</label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="mt-1 w-full rounded-md border border-blue-600 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150"


            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <label className="block text-xs font-semibold text-black tracking-wide">Data Fim</label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="mt-1 w-full rounded-md border border-blue-600 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150"


            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <label className="block text-xs font-semibold text-black tracking-wide">Centro Responsável</label>
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              className="mt-1 w-full rounded-md border border-blue-600 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150"


            >
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-12 md:col-span-3">
            <label className="block text-xs font-semibold text-black tracking-wide">Categoria</label>
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

          <div className="col-span-12 md:col-span-3">
            <label className="block text-xs font-semibold text-black tracking-wide">Solicitação</label>
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

          <div className="col-span-12 md:col-span-3">
            <label className="block text-xs font-semibold text-black tracking-wide">Protocolo</label>
            <input
              value={protocolo}
              onChange={(e) => setProtocolo(e.target.value)}
              className="mt-1 w-full rounded-md border border-blue-600 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150"
              placeholder="Código do protocolo"
            />
          </div>

          <div className="col-span-12 md:col-span-3">
            <label className="block text-xs font-semibold text-black tracking-wide">Solicitante</label>
            <input
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              className="mt-1 w-full rounded-md border border-blue-600 focus:border-blue-700 focus:ring-2 focus:ring-blue-300 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150"

              placeholder="nome ou e-mail"
            />
          </div>

          <div className="col-span-12 md:col-span-3">
            <label className="block text-xs font-semibold text-black tracking-wide">Status</label>
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

          <div className="col-span-12">
            <label className="block text-xs font-semibold text-black tracking-wide">Texto no Formulário</label>
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

      {/* Tabela */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="max-h-[60vh] overflow-auto">
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
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Carregando...
                  </td>
                </tr>
              )}
              {!loading && data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Nenhuma solicitação encontrada
                  </td>
                </tr>
              )}
              {!loading &&
                data.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
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
    </div>
  )
}
