'use client'

import { useEffect, useState } from 'react'

type Props = { endpoint: string; title: string }

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

export default function DocumentsGrid({ endpoint, title }: Props) {
  const [items, setItems] = useState<GridRow[]>([])
  const [tab, setTab] = useState<'documentos' | 'coparticipacao'>('documentos')
  const [term, setTerm] = useState<{ id: string; title: string; content: string } | null>(null)
  const [pendingVersionId, setPendingVersionId] = useState<string | null>(null)

  const parseJsonSafely = async <T,>(res: Response): Promise<T | null> => {
    const body = await res.text()
    if (!body) return null

    try {
      return JSON.parse(body) as T
    } catch {
      return null
    }
  }

  const load = async () => {
    const res = await fetch(`${endpoint}?tab=${tab}`, { cache: 'no-store' })
    const data = await parseJsonSafely<{ items?: GridRow[] } | GridRow[]>(res)
    if (!res.ok || !data) {
      setItems([])
      return
    }

    setItems(Array.isArray(data) ? data : (data.items ?? []))
  }

  useEffect(() => {
    load()
  }, [tab])

  const requestDownload = async (versionId: string) => {
    const res = await fetch(`/api/documents/versions/${versionId}/download`, { cache: 'no-store' })
    const data = await parseJsonSafely<{ requiresTerm?: boolean; term?: { id: string; title: string; content: string }; url?: string }>(res)

    if (!data) return

    if (res.status === 403) {
      if (data.requiresTerm) {
        if (data.term) setTerm(data.term)
        setPendingVersionId(versionId)
        return
      }
    }

    if (data.url) window.open(data.url, '_blank')
  }

  const acceptTerm = async () => {
    if (!term || !pendingVersionId) return
    await fetch('/api/documents/term/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ termId: term.id }),
    })
    setTerm(null)
    await requestDownload(pendingVersionId)
    setPendingVersionId(null)
  }

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{title}</h1>
        <a className="rounded bg-emerald-600 px-3 py-2 text-white" href={'/api/documents/export?format=csv'}>
          Excel
        </a>
      </div>
      <div className="flex gap-2">
        <button className="rounded border px-3 py-1" onClick={() => setTab('documentos')}>Documentos</button>
        <button className="rounded border px-3 py-1" onClick={() => setTab('coparticipacao')}>Coparticipação</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th>Código</th><th>Nº Revisão</th><th>Título</th><th>Centro</th><th>Elaborador</th><th>Status</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.versionId} className="border-t">
              <td>{row.codigo}</td>
              <td>{row.nrRevisao}</td>
              <td>{row.titulo}</td>
              <td>{row.centroResponsavel}</td>
              <td>{row.elaborador}</td>
              <td>{row.status}</td>
              <td className="space-x-2">
                <button className="rounded border px-2" onClick={() => requestDownload(row.versionId)}>👁️</button>
                <button className="rounded border px-2" onClick={() => requestDownload(row.versionId)}>⬇️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {term ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-xl space-y-3 rounded-lg bg-white p-6">
            <h2 className="text-lg font-semibold">{term.title}</h2>
            <p className="max-h-60 overflow-auto whitespace-pre-wrap text-sm">{term.content}</p>
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