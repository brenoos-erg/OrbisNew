'use client'

import { useEffect, useMemo, useState } from 'react'

type ChecklistItem = { key: string; label: string; required: boolean; group: string; maxFiles?: number }

type Payload = {
  protocolo: string
  candidateName: string
  status: string
  checklist: ChecklistItem[]
  checklistStatus: Record<string, boolean>
  canConclude: boolean
}

export default function ExternalAdmissionTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('')
  const [payload, setPayload] = useState<Payload | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)

  useEffect(() => {
    void params.then((p) => setToken(p.token))
  }, [params])

  async function load() {
    if (!token) return
    const res = await fetch(`/api/solicitacoes/externas/admissao/public/${token}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error ?? 'Link inválido.')
      return
    }
    setPayload(data)
    setMessage(null)
  }

  useEffect(() => {
    void load()
  }, [token])

  const progress = useMemo(() => {
    if (!payload) return '0/0'
    const done = payload.checklist.filter((item) => payload.checklistStatus[item.key]).length
    return `${done}/${payload.checklist.length}`
  }, [payload])

  async function upload(itemKey: string, file: File | null) {
    if (!file || !token) return
    setUploadingKey(itemKey)
    const fd = new FormData()
    fd.append('itemKey', itemKey)
    fd.append('file', file)

    const res = await fetch(`/api/solicitacoes/externas/admissao/public/${token}`, {
      method: 'POST',
      body: fd,
    })

    const body = await res.json().catch(() => null)
    if (!res.ok) {
      setMessage(body?.error ?? 'Falha ao enviar arquivo.')
      setUploadingKey(null)
      return
    }

    setUploadingKey(null)
    await load()
  }

  async function conclude() {
    if (!token) return
    const res = await fetch(`/api/solicitacoes/externas/admissao/public/${token}`, { method: 'PATCH' })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      setMessage(body?.error ?? 'Falha ao concluir envio.')
      return
    }
    setMessage('Documentação enviada com sucesso! O RH seguirá com a conferência.')
    await load()
  }

  if (!payload) {
    return <main className="mx-auto max-w-4xl p-6 text-sm text-slate-600">Carregando checklist...</main>
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Checklist de admissão</h1>
      <p className="text-sm text-slate-600">Candidato: <strong>{payload.candidateName}</strong> • Protocolo: {payload.protocolo}</p>
      <p className="text-sm text-slate-600">Progresso: {progress}</p>
      <p className="text-xs text-slate-500">Observação: o exame ASO não é exigido neste portal.</p>

      <div className="space-y-3 rounded border bg-white p-4">
        {payload.checklist.map((item) => (
          <div key={item.key} className="flex flex-col gap-2 rounded border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{item.label} {item.required ? <span className="text-red-600">*</span> : null}</span>
              <span className={`text-xs font-semibold ${payload.checklistStatus[item.key] ? 'text-emerald-700' : 'text-slate-500'}`}>
                {payload.checklistStatus[item.key] ? 'OK' : 'Pendente'}
              </span>
            </div>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => upload(item.key, e.target.files?.[0] ?? null)}
            />
            {uploadingKey === item.key && <span className="text-xs text-slate-500">Enviando...</span>}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={!payload.canConclude}
        className="rounded bg-orange-500 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        onClick={conclude}
      >
        Concluir envio
      </button>

      {message && <p className="text-sm text-slate-700">{message}</p>}
    </main>
  )
}
