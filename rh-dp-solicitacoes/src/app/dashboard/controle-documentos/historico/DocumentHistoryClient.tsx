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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Histórico documental</h1>
      <p className="mt-1 text-sm text-slate-600">Selecione um documento para focar no histórico de VIEW, DOWNLOAD e PRINT.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Código" value={filters.code} onChange={(e) => setFilters((v) => ({ ...v, code: e.target.value }))} />
        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Título" value={filters.title} onChange={(e) => setFilters((v) => ({ ...v, title: e.target.value }))} />
        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Revisão" value={filters.revision} onChange={(e) => setFilters((v) => ({ ...v, revision: e.target.value }))} />
        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Usuário" value={filters.user} onChange={(e) => setFilters((v) => ({ ...v, user: e.target.value }))} />
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={filters.action} onChange={(e) => setFilters((v) => ({ ...v, action: e.target.value }))}>
          <option value="">Ação</option>
          <option value="VIEW">VIEW</option>
          <option value="DOWNLOAD">DOWNLOAD</option>
          <option value="PRINT">PRINT</option>
        </select>
        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={filters.startDate} onChange={(e) => setFilters((v) => ({ ...v, startDate: e.target.value }))} />
        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={filters.endDate} onChange={(e) => setFilters((v) => ({ ...v, endDate: e.target.value }))} />
        <div className="flex gap-2">
          <button className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white" onClick={() => setAppliedFilters(filters)}>Filtrar</button>
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => { setFilters(initialFilters); setAppliedFilters(initialFilters); setSelectedDocumentId('') }}>Limpar</button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
        <aside className="overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-600">Documentos</div>
          <div className="max-h-[560px] overflow-auto">
            {documents.map((doc) => (
              <button
                key={doc.id}
                className={`block w-full border-b border-slate-100 px-3 py-3 text-left text-sm ${selectedDocumentId === doc.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                onClick={() => setSelectedDocumentId(doc.id)}
              >
                <p className="font-medium text-slate-800">{doc.code}</p>
                <p className="text-slate-600">{doc.title}</p>
                <p className="mt-1 text-xs text-slate-500">{doc.totalEvents} evento(s)</p>
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
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2">User-Agent</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2">{item.action}</td>
                  <td className="px-3 py-2">{item.document.code} — {item.document.title}</td>
                  <td className="px-3 py-2">REV{String(item.version.revisionNumber).padStart(2, '0')}</td>
                  <td className="px-3 py-2">{item.user.fullName || item.user.email}</td>
                  <td className="px-3 py-2">{item.ip || '-'}</td>
                  <td className="px-3 py-2">{item.userAgent || '-'}</td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={7}>
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