'use client'

import { useEffect, useMemo, useState } from 'react'

type Item = {
  id: string
  action: 'VIEW' | 'DOWNLOAD' | 'PRINT'
  createdAt: string
  ip: string | null
  userAgent: string | null
  user: { id: string; fullName: string | null; email: string }
  document: { id: string; code: string; title: string }
  version: { id: string; revisionNumber: number }
}
type DocOption = { id: string; code: string; title: string; totalEvents: number }

const initialFilters = { code: '', title: '', revision: '', user: '', action: '', startDate: '', endDate: '' }

const actionLabel: Record<Item['action'], string> = {
  VIEW: 'Visualização',
  DOWNLOAD: 'Download',
  PRINT: 'Impressão',
}

const actionBadgeClass: Record<Item['action'], string> = {
  VIEW: 'bg-sky-100 text-sky-800',
  DOWNLOAD: 'bg-emerald-100 text-emerald-800',
  PRINT: 'bg-amber-100 text-amber-800',
}


export default function DocumentHistoryClient() {
  const [items, setItems] = useState<Item[]>([])
  const [documents, setDocuments] = useState<DocOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [filters, setFilters] = useState(initialFilters)
  const [appliedFilters, setAppliedFilters] = useState(initialFilters)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('pageSize', '150')
    if (selectedDocumentId) params.set('documentId', selectedDocumentId)
    Object.entries(appliedFilters).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    return params.toString()
  }, [appliedFilters, selectedDocumentId])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/documents/history?${query}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items ?? [])
        setDocuments(data.documents ?? [])
      })
      .catch(() => {
        setItems([])
        setDocuments([])
      })
      .finally(() => setLoading(false))
  }, [query])

  const activeFiltersCount = Object.values(appliedFilters).filter(Boolean).length

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Histórico documental</h1>
      <p className="mt-1 text-sm text-slate-600">
        Acompanhe o uso dos documentos com foco no que importa para a Qualidade. Informações técnicas ficam disponíveis apenas nos detalhes.
      </p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Filtros de consulta</h2>
          <span className="text-xs text-slate-500">
            {activeFiltersCount > 0 ? `${activeFiltersCount} filtro(s) aplicado(s)` : 'Nenhum filtro aplicado'}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>Documento (código)</span>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              placeholder="Ex.: IT-001"
              value={filters.code}
              onChange={(e) => setFilters((v) => ({ ...v, code: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>Título do documento</span>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              placeholder="Digite parte do título"
              value={filters.title}
              onChange={(e) => setFilters((v) => ({ ...v, title: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>Revisão</span>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              placeholder="Ex.: 03"
              value={filters.revision}
              onChange={(e) => setFilters((v) => ({ ...v, revision: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>Usuário</span>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              placeholder="Nome ou e-mail"
              value={filters.user}
              onChange={(e) => setFilters((v) => ({ ...v, user: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>Ação realizada</span>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              value={filters.action}
              onChange={(e) => setFilters((v) => ({ ...v, action: e.target.value }))}
            >
              <option value="">Todas</option>
              <option value="VIEW">Visualização</option>
              <option value="DOWNLOAD">Download</option>
              <option value="PRINT">Impressão</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>Período (início)</span>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((v) => ({ ...v, startDate: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>Período (fim)</span>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((v) => ({ ...v, endDate: e.target.value }))}
            />
          </label>
          <div className="flex items-end gap-2">
            <button className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800" onClick={() => setAppliedFilters(filters)}>
              Aplicar
            </button>
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setFilters(initialFilters)
                setAppliedFilters(initialFilters)
                setSelectedDocumentId('')
              }}
            >
              Limpar
            </button>
          </div>
         </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Documentos</p>
            <p className="mt-1 text-xs text-slate-500">Selecione um documento para visualizar apenas o histórico dele.</p>
          </div>
          <div className="max-h-[560px] overflow-auto">
            {documents.map((doc) => (
              <button
                key={doc.id}
                className={`block w-full border-b border-slate-100 px-4 py-3.5 text-left ${selectedDocumentId === doc.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                onClick={() => setSelectedDocumentId(doc.id)}
              >
                <p className="text-sm font-semibold text-slate-900">{doc.code}</p>
                <p className="mt-1 text-sm leading-5 text-slate-700">{doc.title}</p>
                <p className="mt-2 text-xs text-slate-500">{doc.totalEvents} evento(s)</p>
              </button>
            ))}
            {!documents.length ? <p className="px-3 py-6 text-center text-sm text-slate-500">Nenhum documento encontrado.</p> : null}
          </div>
        </aside>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2">Data/Hora</th>
                <th className="px-3 py-2">Ação</th>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Revisão</th>
                <th className="px-3 py-2">Usuário</th>
                <th className="px-3 py-2">Detalhes técnicos</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${actionBadgeClass[item.action]}`}>
                      {actionLabel[item.action]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800">{item.document.code}</p>
                    <p className="text-slate-600">{item.document.title}</p>
                  </td>
                  <td className="px-3 py-2">REV{String(item.version.revisionNumber).padStart(2, '0')}</td>
                  <td className="px-3 py-2">{item.user.fullName || item.user.email}</td>
                  <td className="px-3 py-2">
                    <details>
                      <summary className="cursor-pointer text-xs font-medium text-blue-700 hover:text-blue-800">Ver informações técnicas</summary>
                      <div className="mt-2 space-y-1 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                        <p>
                          <span className="font-semibold text-slate-700">IP:</span> {item.ip || '-'}
                        </p>
                        <p className="break-all">
                          <span className="font-semibold text-slate-700">User-Agent:</span> {item.userAgent || '-'}
                        </p>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                    {loading ? 'Carregando histórico...' : 'Nenhum evento encontrado para os filtros atuais.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}