'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Download, Filter, RefreshCcw, Search, Plus, Info, XCircle } from 'lucide-react'
import { format } from 'date-fns'

/** ===== TIPOS DA LISTA (tabela) ===== */

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

/** ===== TIPOS DO DETALHE ===== */

type CampoEspecifico = {
  name: string
  label: string
  type: string
  required?: boolean
  options?: string[]
}

type SchemaJson = {
  camposEspecificos?: CampoEspecifico[]
}

type PayloadSolicitante = {
  fullName?: string
  email?: string
  login?: string
  phone?: string
  costCenterText?: string
}

type Payload = {
  campos?: Record<string, any>
  solicitante?: PayloadSolicitante
  [key: string]: any
}

type Attachment = {
  id: string
  filename: string
  url: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

type Comment = {
  id: string
  texto: string
  createdAt: string
  autor?: {
    id: string
    fullName: string
    email: string
  } | null
}

type SolicitationDetail = {
  id: string
  protocolo: string
  titulo: string
  descricao: string | null
  status: string
  dataAbertura: string
  dataPrevista?: string | null
  dataFechamento?: string | null
  dataCancelamento?: string | null
  tipo?: {
    id: string
    nome: string
    descricao?: string | null
    schemaJson?: SchemaJson
  } | null
  costCenter?: {
    description: string
  } | null
  payload?: Payload
  anexos?: Attachment[]
  comentarios?: Comment[]
}

/** ===== CONSTANTES ===== */

const PAGE_SIZE_OPTIONS = [10, 25, 50]

const LABEL_RO = 'block text-xs font-semibold text-slate-700 uppercase tracking-wide'
const INPUT_RO =
  'mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700' +
  ' focus:outline-none cursor-default'

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

  // ===== ESTADO DO DETALHE =====
  const [selectedRow, setSelectedRow] = useState<Row | null>(null)
  const [detail, setDetail] = useState<SolicitationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // combos mockados (troque por fetchs reais depois)
  const centros = useMemo(
    () => [
      { id: '', nome: 'Selecione uma opção' },
      { id: 'ti', nome: 'Tecnologia da Informação' },
      { id: 'rh', nome: 'Recursos Humanos' },
    ],
    [],
  )
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
      { id: 'EM_ANALISE', nome: 'EM_ANALISE' },
      { id: 'AGUARDANDO_INFO', nome: 'AGUARDANDO_INFO' },
      { id: 'APROVADA', nome: 'APROVADA' },
      { id: 'REJEITADA', nome: 'REJEITADA' },
      { id: 'CONCLUIDA', nome: 'CONCLUIDA' },
    ],
    [],
  )

  function buildQuery() {
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('pageSize', String(pageSize))
    // neste módulo usamos sempre as ENVIADAS pelo usuário logado
    qs.set('scope', 'sent')
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

  /** ===== DETALHE ===== */

  async function openDetail(row: Row) {
    setSelectedRow(row)
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
    setSelectedRow(null)
    setDetail(null)
    setDetailError(null)
  }

  // helpers de formatação
  function formatDate(dateStr?: string | null) {
    if (!dateStr) return '-'
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy HH:mm')
    } catch {
      return '-'
    }
  }

  const payload = (detail?.payload ?? {}) as Payload
  const payloadSolic = payload.solicitante ?? {}
  const payloadCampos = payload.campos ?? {}

  const schema = (detail?.tipo?.schemaJson ?? {}) as SchemaJson
  const camposSchema = schema.camposEspecificos ?? []

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

          {/* Botões Detalhes / Cancelar podem ser ligados depois a uma seleção de linha */}
          <button
            onClick={() => {
              if (!selectedRow) {
                alert('Clique em uma solicitação na tabela para ver os detalhes.')
              } else {
                openDetail(selectedRow)
              }
            }}
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
          <div className="col-span-12 md:col-span-3">
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
          <div className="col-span-12 md:col-span-3">
            <label className="block text-xs font-semibold text-black tracking-wide">
              Centro Responsável
            </label>
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

          <div className="col-span-12 md:col-span-3">
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

          <div className="col-span-12 md:col-span-3">
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

          <div className="col-span-12 md:col-span-3">
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
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => openDetail(r)}
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

      {/* ===== MODAL DE DETALHES ===== */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-white shadow-xl">
            {/* Cabeçalho do modal */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Detalhes da Solicitação
                </h2>
                <p className="text-xs text-slate-500">
                  Protocolo {detail?.protocolo ?? selectedRow.protocolo ?? '-'}
                </p>
              </div>
              <button
                onClick={closeDetail}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-5 px-5 py-4 text-sm">
              {detailLoading && (
                <p className="text-xs text-slate-500">Carregando detalhes...</p>
              )}

              {detailError && (
                <p className="text-xs text-red-600">{detailError}</p>
              )}

              {/* Só mostra os campos se já carregou algo */}
              {detail && (
                <>
                  {/* Bloco principal (igual ao topo do seu print) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL_RO}>Status</label>
                      <input
                        className={INPUT_RO}
                        readOnly
                        value={detail.status ?? selectedRow.status}
                      />
                    </div>
                    <div>
                      <label className={LABEL_RO}>Protocolo</label>
                      <input
                        className={INPUT_RO}
                        readOnly
                        value={detail.protocolo ?? selectedRow.protocolo ?? ''}
                      />
                    </div>
                    <div>
                      <label className={LABEL_RO}>Solicitação</label>
                      <input
                        className={INPUT_RO}
                        readOnly
                        value={
                          detail.titulo ??
                          detail.tipo?.nome ??
                          selectedRow.titulo ??
                          ''
                        }
                      />
                    </div>
                    <div>
                      <label className={LABEL_RO}>Centro Responsável</label>
                      <input
                        className={INPUT_RO}
                        readOnly
                        value={
                          selectedRow.setorDestino ??
                          detail.costCenter?.description ??
                          ''
                        }
                      />
                    </div>
                    <div>
                      <label className={LABEL_RO}>Data Abertura</label>
                      <input
                        className={INPUT_RO}
                        readOnly
                        value={
                          formatDate(detail.dataAbertura) ||
                          (selectedRow.createdAt
                            ? formatDate(selectedRow.createdAt)
                            : '-')
                        }
                      />
                    </div>
                    <div>
                      <label className={LABEL_RO}>Prazo Solução</label>
                      <input
                        className={INPUT_RO}
                        readOnly
                        value={formatDate(detail.dataPrevista)}
                      />
                    </div>
                    <div>
                      <label className={LABEL_RO}>Data Fechamento</label>
                      <input
                        className={INPUT_RO}
                        readOnly
                        value={formatDate(detail.dataFechamento)}
                      />
                    </div>
                  </div>

                  {/* Descrição */}
                  {detail.descricao && (
                    <div>
                      <label className={LABEL_RO}>Descrição da Solicitação</label>
                      <textarea
                        className={`${INPUT_RO} min-h-[80px]`}
                        readOnly
                        value={detail.descricao}
                      />
                    </div>
                  )}

                  {/* Anexos da Solicitação */}
                  {detail.anexos && detail.anexos.length > 0 && (
                    <div>
                      <label className={LABEL_RO}>Anexo(s) da Solicitação</label>
                      <div className="mt-2 space-y-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                        {detail.anexos.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between"
                          >
                            <span>{a.filename}</span>
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-medium text-blue-600 hover:underline"
                            >
                              Download
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dados do Solicitante (payload.solicitante) */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700 mb-2">
                      Dados do Solicitante
                    </p>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className={LABEL_RO}>Nome completo</label>
                        <input
                          className={INPUT_RO}
                          readOnly
                          value={payloadSolic.fullName ?? ''}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL_RO}>E-mail</label>
                          <input
                            className={INPUT_RO}
                            readOnly
                            value={payloadSolic.email ?? ''}
                          />
                        </div>
                        <div>
                          <label className={LABEL_RO}>Login</label>
                          <input
                            className={INPUT_RO}
                            readOnly
                            value={payloadSolic.login ?? ''}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL_RO}>Telefone</label>
                          <input
                            className={INPUT_RO}
                            readOnly
                            value={payloadSolic.phone ?? ''}
                          />
                        </div>
                        <div>
                          <label className={LABEL_RO}>Centro de Custo</label>
                          <input
                            className={INPUT_RO}
                            readOnly
                            value={payloadSolic.costCenterText ?? ''}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Formulário do tipo de solicitação (campos específicos) */}
                  {camposSchema.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700 mb-2">
                        Formulário do tipo de solicitação
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {camposSchema.map((campo) => (
                          <div key={campo.name}>
                            <label className={LABEL_RO}>{campo.label}</label>
                            <input
                              className={INPUT_RO}
                              readOnly
                              value={
                                payloadCampos[campo.name] !== undefined
                                  ? String(payloadCampos[campo.name])
                                  : ''
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comentários / Histórico simples */}
                  {detail.comentarios && detail.comentarios.length > 0 && (
                    <div>
                      <label className={LABEL_RO}>Histórico de Atendimento</label>
                      <div className="mt-2 space-y-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                        {detail.comentarios.map((c) => (
                          <div key={c.id}>
                            <div className="text-[10px] text-slate-500">
                              {formatDate(c.createdAt)} - {c.autor?.fullName ?? '—'}
                            </div>
                            <div>{c.texto}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 px-5 py-3">
              <button
                onClick={closeDetail}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
