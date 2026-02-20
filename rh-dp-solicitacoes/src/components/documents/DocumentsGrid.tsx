'use client'

import { Download, Eye, Filter, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type Props = { endpoint: string; title: string; fixedStatus?: string }

type GridRow = {
  versionId: string
  dataPublicacao: string | null
  codigo: string
  nrRevisao: number
  titulo: string
  centroResponsavel: string
  elaborador: string
  vencimento: string | null
  status: string
}

type Option = { id: string; name?: string; description?: string; fullName?: string }

const PAGE_SIZE_OPTIONS = [10, 25, 50]

export default function DocumentsGrid({ endpoint, title, fixedStatus }: Props) {
  const [items, setItems] = useState<GridRow[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState('publishedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFiltersMobile, setShowFiltersMobile] = useState(false)

  const [term, setTerm] = useState<{ id: string; title: string; content: string } | null>(null)
  const [pendingVersionId, setPendingVersionId] = useState<string | null>(null)

  const [draftFilters, setDraftFilters] = useState({
    code: '',
    title: '',
    documentTypeId: '',
    ownerDepartmentId: '',
    authorUserId: '',
    status: fixedStatus ?? '',
  })
  const [appliedFilters, setAppliedFilters] = useState(draftFilters)

  const [meta, setMeta] = useState<{ documentTypes: Option[]; departments: Option[]; authors: Option[] }>({
    documentTypes: [],
    departments: [],
    authors: [],
  })

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  const parseJsonSafely = async <T,>(res: Response): Promise<T | null> => {
    const body = await res.text()
    if (!body) return null

    try {
      return JSON.parse(body) as T
    } catch {
      return null
    }
  }

  const buildQuery = (format?: 'csv' | 'pdf') => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    params.set('sortBy', sortBy)
    params.set('sortOrder', sortOrder)
    if (format) params.set('format', format)

    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })

    return params.toString()
  }

  const load = async () => {
    setLoading(true)
    const res = await fetch(`${endpoint}?${buildQuery()}`, { cache: 'no-store' })
    const data = await parseJsonSafely<{ items?: GridRow[]; total?: number }>(res)
    if (!res.ok || !data) {
      setItems([])
      setTotal(0)
      setLoading(false)
      return
    }

    setItems(data.items ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }

  useEffect(() => {
    fetch('/api/documents/filters', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setMeta(data))
      .catch(() => null)
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, pageSize, sortBy, sortOrder, appliedFilters])

  const requestDocumentAccess = async (versionId: string, intent: 'view' | 'download') => {
    const res = await fetch(`/api/documents/versions/${versionId}/download`, { cache: 'no-store' })
    const data = await parseJsonSafely<{ requiresTerm?: boolean; term?: { id: string; title: string; content: string }; url?: string }>(res)

    if (!data) return

    if (res.status === 403 && data.requiresTerm) {
      if (data.term) setTerm(data.term)
      setPendingVersionId(versionId)
      return
    }

    if (data.url) {
      if (intent === 'download') {
        const anchor = document.createElement('a')
        anchor.href = data.url
        anchor.target = '_blank'
        anchor.rel = 'noreferrer'
        anchor.click()
      } else {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      }
    }
  }

  const acceptTerm = async () => {
    if (!term || !pendingVersionId) return
    await fetch('/api/documents/term/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ termId: term.id }),
    })
    setTerm(null)
    await requestDocumentAccess(pendingVersionId, 'download')
    setPendingVersionId(null)
  }

  const onSearch = () => {
    setPage(1)
    setAppliedFilters({ ...draftFilters, status: fixedStatus ?? draftFilters.status })
  }

  const clearFilters = () => {
    const cleared = {
      code: '',
      title: '',
      documentTypeId: '',
      ownerDepartmentId: '',
      authorUserId: '',
      status: fixedStatus ?? '',
    }
    setDraftFilters(cleared)
    setAppliedFilters(cleared)
    setPage(1)
  }

  const changeSort = (nextSortBy: string) => {
    if (sortBy === nextSortBy) {
      setSortOrder((value) => (value === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortBy(nextSortBy)
    setSortOrder('asc')
  }

  const FiltersContent = (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
      <input className="rounded border px-3 py-2" placeholder="Código" value={draftFilters.code} onChange={(e) => setDraftFilters((v) => ({ ...v, code: e.target.value }))} />
      <input className="rounded border px-3 py-2" placeholder="Título" value={draftFilters.title} onChange={(e) => setDraftFilters((v) => ({ ...v, title: e.target.value }))} />
      <select className="rounded border px-3 py-2" value={draftFilters.documentTypeId} onChange={(e) => setDraftFilters((v) => ({ ...v, documentTypeId: e.target.value }))}>
        <option value="">Tipo Documento</option>
        {meta.documentTypes.map((option) => <option key={option.id} value={option.id}>{option.description}</option>)}
      </select>
      <select className="rounded border px-3 py-2" value={draftFilters.ownerDepartmentId} onChange={(e) => setDraftFilters((v) => ({ ...v, ownerDepartmentId: e.target.value }))}>
        <option value="">Centro Responsável</option>
        {meta.departments.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
      <select className="rounded border px-3 py-2" value={draftFilters.authorUserId} onChange={(e) => setDraftFilters((v) => ({ ...v, authorUserId: e.target.value }))}>
        <option value="">Elaborador / Responsável</option>
        {meta.authors.map((option) => <option key={option.id} value={option.id}>{option.fullName}</option>)}
      </select>
      {!fixedStatus ? (
        <select className="rounded border px-3 py-2" value={draftFilters.status} onChange={(e) => setDraftFilters((v) => ({ ...v, status: e.target.value }))}>
          <option value="">Status</option>
          <option value="PUBLICADO">PUBLICADO</option>
          <option value="AG_APROVACAO">AG_APROVACAO</option>
          <option value="EM_ANALISE_QUALIDADE">EM_ANALISE_QUALIDADE</option>
          <option value="EM_REVISAO">EM_REVISAO</option>
          <option value="EM_ELABORACAO">EM_ELABORACAO</option>
        </select>
      ) : <div />}

      <div className="col-span-full flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded bg-blue-700 px-3 py-2 text-white" onClick={onSearch}><Search size={16} />Pesquisar</button>
        <button className="inline-flex items-center gap-2 rounded border px-3 py-2" onClick={clearFilters}><X size={16} />Limpar</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-semibold">{title}</h1>
        <div className="flex gap-2">
          <a className="rounded bg-emerald-600 px-3 py-2 text-white" href={`/api/documents/export?${buildQuery('csv')}`}>Exportar CSV</a>
          <a className="rounded bg-slate-700 px-3 py-2 text-white" href={`/api/documents/export?${buildQuery('pdf')}`}>Exportar PDF</a>
        </div>
      </div>

      <div className="hidden md:block">{FiltersContent}</div>
      <button className="inline-flex items-center gap-2 rounded border px-3 py-2 md:hidden" onClick={() => setShowFiltersMobile(true)}><Filter size={16} />Filtros</button>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="cursor-pointer" onClick={() => changeSort('publishedAt')}>Data Publicação</th>
              <th className="cursor-pointer" onClick={() => changeSort('code')}>Código</th>
              <th className="cursor-pointer" onClick={() => changeSort('revisionNumber')}>Nº Revisão</th>
              <th>Título</th>
              <th>Centro Responsável</th>
              <th>Elaborador</th>
              <th className="cursor-pointer" onClick={() => changeSort('expiresAt')}>Vencimento</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, idx) => <tr key={idx} className="border-t"><td colSpan={9} className="animate-pulse px-2 py-3 text-slate-400">Carregando...</td></tr>)
            ) : items.length === 0 ? (
              <tr className="border-t"><td colSpan={9} className="px-2 py-3 text-slate-500">Nenhum resultado encontrado.</td></tr>
            ) : (
              items.map((row) => (
                <tr key={row.versionId} className="border-t">
                  <td>{row.dataPublicacao ? new Date(row.dataPublicacao).toLocaleDateString('pt-BR') : '-'}</td>
                  <td>{row.codigo}</td>
                  <td>{row.nrRevisao}</td>
                  <td>{row.titulo}</td>
                  <td>{row.centroResponsavel}</td>
                  <td>{row.elaborador}</td>
                  <td>{row.vencimento ? new Date(row.vencimento).toLocaleDateString('pt-BR') : '-'}</td>
                  <td>{row.status}</td>
                  <td className="space-x-2">
                    <button className="inline-flex items-center gap-1 rounded border px-2 py-1" onClick={() => requestDocumentAccess(row.versionId, 'view')}><Eye size={14} />Visualizar</button>
                    <button className="inline-flex items-center gap-1 rounded border px-2 py-1" onClick={() => requestDocumentAccess(row.versionId, 'download')}><Download size={14} />Download</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? <div className="rounded border p-3 text-slate-400">Carregando...</div> : null}
        {!loading && items.length === 0 ? <div className="rounded border p-3 text-slate-500">Nenhum resultado encontrado.</div> : null}
        {items.map((row) => (
          <article key={row.versionId} className="space-y-2 rounded border p-3">
            <div className="flex items-center justify-between"><strong>{row.codigo}</strong><span className="rounded bg-slate-100 px-2 py-0.5 text-xs">Rev {row.nrRevisao} · {row.status}</span></div>
            <p className="text-sm font-medium">{row.titulo}</p>
            <p className="text-xs text-slate-600">{row.centroResponsavel} · {row.elaborador}</p>
            <p className="text-xs text-slate-600">Pub: {row.dataPublicacao ? new Date(row.dataPublicacao).toLocaleDateString('pt-BR') : '-'} · Venc: {row.vencimento ? new Date(row.vencimento).toLocaleDateString('pt-BR') : '-'}</p>
            <div className="flex gap-2">
              <button className="inline-flex flex-1 items-center justify-center gap-2 rounded border px-3 py-2" onClick={() => requestDocumentAccess(row.versionId, 'view')}><Eye size={14} />Ver</button>
              <button className="inline-flex flex-1 items-center justify-center gap-2 rounded bg-slate-800 px-3 py-2 text-white" onClick={() => requestDocumentAccess(row.versionId, 'download')}><Download size={14} />Baixar</button>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">Mostrar</span>
          <select className="rounded border px-2 py-1" value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)) }}>
            {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded border px-3 py-1" disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>Anterior</button>
          <span className="text-sm">Página {page} de {totalPages}</span>
          <button className="rounded border px-3 py-1" disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))}>Próximo</button>
        </div>
      </div>

      {showFiltersMobile ? (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setShowFiltersMobile(false)}>
          <div className="ml-auto h-full w-[90%] max-w-sm overflow-auto bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Filtros</h2><button className="rounded border px-2 py-1" onClick={() => setShowFiltersMobile(false)}>Fechar</button></div>
            {FiltersContent}
          </div>
        </div>
      ) : null}

      {term ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-xl space-y-3 rounded-lg bg-white p-6">
            <h2 className="text-lg font-semibold">{term.title}</h2>
            <p className="max-h-60 overflow-auto whitespace-pre-wrap text-sm">{term.content}</p>
            <p className="text-sm text-slate-600">Ao aceitar, você confirma ciência das responsabilidades para acesso ao documento.</p>
            <div className="flex justify-end gap-2">
              <button className="rounded border px-3 py-2" onClick={() => setTerm(null)}>Não aceito</button>
              <button className="rounded bg-emerald-700 px-3 py-2 text-white" onClick={acceptTerm}>Aceito</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}