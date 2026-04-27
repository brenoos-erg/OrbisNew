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
  externalUrl: string | null
  emailDeliveryStatus: string
  emailSentAt: string | null
  emailResentAt: string | null
  emailError: string | null
  sentDocuments: number
  totalDocuments: number
  updatedAt: string
}

export default function ExternalAdmissionDashboardPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)

  async function load() {
    setAccessDenied(false)
    const res = await fetch('/api/solicitacoes/externas/admissao', { cache: 'no-store' })
    if (res.status === 403) {
      setAccessDenied(true)
      setRows([])
      return
    }
    if (!res.ok) return
    const payload = await res.json()
    setRows(payload.rows ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function createProcess() {
    setFeedback(null)
    const res = await fetch('/api/solicitacoes/externas/admissao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateName, candidateEmail }),
    })
    const payload = await res.json()
    if (!res.ok) {
      if (res.status === 403) {
        setAccessDenied(true)
      }
      setFeedback(payload.error ?? 'Não foi possível criar o processo.')
      return
    }

    setGeneratedLink(payload.externalUrl)
    setCandidateName('')
    setCandidateEmail('')
    setFeedback(payload.emailSent ? 'Processo criado e e-mail enviado ao candidato.' : `Processo criado sem envio de e-mail. Erro: ${payload.emailError ?? 'desconhecido'}`)
    await load()
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/solicitacoes/externas/admissao/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.status === 403) {
      setAccessDenied(true)
      setFeedback('Apenas usuários de RH podem alterar solicitações externas.')
      return
    }
    await load()
  }

  async function resendEmail(id: string) {
    const res = await fetch(`/api/solicitacoes/externas/admissao/${id}`, { method: 'POST' })
    const payload = await res.json().catch(() => null)

    if (!res.ok) {
      if (res.status === 403) {
        setAccessDenied(true)
      }
      setFeedback(payload?.error ?? 'Falha ao reenviar e-mail.')
      return
    }

    setFeedback(payload.emailSent ? 'E-mail reenviado com sucesso.' : `Reenvio falhou: ${payload.emailError ?? 'erro não informado'}`)
    await load()
  }

  async function copyLink(url: string | null) {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setFeedback('Link copiado para a área de transferência.')
  }

  async function deleteProcess(id: string) {
    const confirmed = window.confirm('Confirma a exclusão desta solicitação externa? Essa ação irá cancelar o processo.')
    if (!confirmed) return

    const res = await fetch(`/api/solicitacoes/externas/admissao/${id}`, { method: 'DELETE' })
    const payload = await res.json().catch(() => null)

    if (!res.ok) {
      if (res.status === 403) {
        setAccessDenied(true)
      }
      setFeedback(payload?.error ?? 'Falha ao excluir solicitação externa.')
      return
    }

    setFeedback('Solicitação externa excluída com sucesso.')
    await load()
  }

  if (accessDenied) {
    return (
      <div className="p-6">
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Acesso negado. Apenas usuários vinculados ao RH podem acessar solicitações externas de admissão.
        </div>
      </div>
    )
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
            Criar processo e enviar e-mail
          </button>
        </div>
        {generatedLink && (
          <p className="mt-2 text-sm text-slate-700">
            Link gerado: <a className="text-blue-700 underline" href={generatedLink} target="_blank" rel="noreferrer">{generatedLink}</a>
          </p>
        )}
        {feedback && <p className="mt-2 text-sm text-slate-700">{feedback}</p>}
      </section>

      <section className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Protocolo</th>
              <th className="px-3 py-2">Candidato</th>
              <th className="px-3 py-2">Checklist</th>
              <th className="px-3 py-2">E-mail</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-3 py-2">{row.protocolo}</td>
                <td className="px-3 py-2">
                  {row.candidateName}
                  <br />
                  <span className="text-xs text-slate-500">{row.candidateEmail}</span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-700">
                  {row.sentDocuments}/{row.totalDocuments} arquivo(s)
                </td>
                <td className="px-3 py-2 text-xs">
                  <p className={row.emailDeliveryStatus === 'FAILED' ? 'text-red-700' : 'text-emerald-700'}>{row.emailDeliveryStatus}</p>
                  {row.emailSentAt && <p className="text-slate-500">enviado: {new Date(row.emailSentAt).toLocaleString('pt-BR')}</p>}
                  {row.emailResentAt && <p className="text-slate-500">reenviado: {new Date(row.emailResentAt).toLocaleString('pt-BR')}</p>}
                  {row.emailError && <p className="text-red-700">erro: {row.emailError}</p>}
                </td>
                <td className="px-3 py-2">
                  <select className="rounded border px-2 py-1" value={row.status} onChange={(e) => updateStatus(row.id, e.target.value)}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">Atualizado: {new Date(row.updatedAt).toLocaleString('pt-BR')}</p>
                </td>
                <td className="space-y-2 px-3 py-2">
                  <button type="button" className="block rounded border px-2 py-1 text-xs" onClick={() => copyLink(row.externalUrl)}>Copiar link</button>
                  <button type="button" className="block rounded border px-2 py-1 text-xs" onClick={() => resendEmail(row.id)}>Reenviar e-mail</button>
                  <button type="button" className="block rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => deleteProcess(row.id)}>Excluir</button>
                  {row.externalUrl && (
                    <a className="block text-xs text-blue-700 underline" href={row.externalUrl} target="_blank" rel="noreferrer">Abrir checklist</a>
                  )}
                  <a className="block text-xs text-blue-700 underline" href={`/api/solicitacoes/externas/admissao/${row.id}`} target="_blank" rel="noreferrer">Abrir detalhes</a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Nenhum processo criado.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
