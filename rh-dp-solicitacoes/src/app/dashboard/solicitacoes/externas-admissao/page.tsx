'use client'

import { useEffect, useState } from 'react'

const STATUS_OPTIONS = [
  'AGUARDANDO_ENVIO',
  'ENVIADO_PELO_CANDIDATO',
  'EM_CONFERENCIA',
  'PENDENTE',
  'CONCLUIDO',
]

type Row = {
  id: string
  protocolo: string
  status: string
  candidateName: string
  candidateEmail: string
  updatedAt: string
}

export default function ExternalAdmissionDashboardPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/solicitacoes/externas/admissao', { cache: 'no-store' })
    if (!res.ok) return
    const payload = await res.json()
    setRows(payload.rows ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function createProcess() {
    const res = await fetch('/api/solicitacoes/externas/admissao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateName, candidateEmail }),
    })
    const payload = await res.json()
    if (!res.ok) return
    setGeneratedLink(payload.externalUrl)
    setCandidateName('')
    setCandidateEmail('')
    await load()
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/solicitacoes/externas/admissao/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold">Solicitações Externas — Admissão</h1>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Novo processo externo</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input className="rounded border px-3 py-2" placeholder="Nome do candidato" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="E-mail do candidato" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} />
          <button type="button" className="rounded bg-orange-500 px-3 py-2 font-semibold text-white" onClick={createProcess}>
            Gerar link seguro
          </button>
        </div>
        {generatedLink && (
          <p className="mt-2 text-sm text-slate-700">
            Link gerado: <a className="text-blue-700 underline" href={generatedLink} target="_blank" rel="noreferrer">{generatedLink}</a>
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Protocolo</th>
              <th className="px-3 py-2">Candidato</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Atualizado</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">{row.protocolo}</td>
                <td className="px-3 py-2">{row.candidateName}<br /><span className="text-xs text-slate-500">{row.candidateEmail}</span></td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{new Date(row.updatedAt).toLocaleString('pt-BR')}</td>
                <td className="px-3 py-2">
                  <select className="rounded border px-2 py-1" value={row.status} onChange={(e) => updateStatus(row.id, e.target.value)}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Nenhum processo criado.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
