'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'

export default function NcAlertAdminPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subjectTemplate, setSubjectTemplate] = useState('')
  const [bodyTemplate, setBodyTemplate] = useState('')
  const [eventCreatedEnabled, setEventCreatedEnabled] = useState(true)
  const [eventUpdatedEnabled, setEventUpdatedEnabled] = useState(false)
  const [recipientText, setRecipientText] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await fetch('/api/sgi/qualidade/nao-conformidades/alertas-config', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Falha ao carregar configuração.')
        setLoading(false)
        return
      }

      setSubjectTemplate(data.subjectTemplate || '')
      setBodyTemplate(data.bodyTemplate || '')
      setEventCreatedEnabled(Boolean(data.eventCreatedEnabled))
      setEventUpdatedEnabled(Boolean(data.eventUpdatedEnabled))
      setRecipientText((data.recipients || []).map((item: any) => item.email).join('\n'))
      setError(null)
      setLoading(false)
    }

    void load()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const recipients = recipientText
      .split(/\n|,|;/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((email) => ({ email }))

    const res = await fetch('/api/sgi/qualidade/nao-conformidades/alertas-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subjectTemplate, bodyTemplate, eventCreatedEnabled, eventUpdatedEnabled, recipients }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data?.error || 'Falha ao salvar configuração.')
      return
    }

    setError(null)
    alert('Configuração de alertas salva com sucesso.')
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Alertas de NC (Admin)</h1>
          <p className="text-sm text-slate-600">Configure destinatários, assunto e mensagem de e-mail por evento da NC/plano de ação.</p>
        </div>
        <Link href="/dashboard/sgi/qualidade/nao-conformidades" className="rounded-md border border-slate-200 px-3 py-2 text-sm">Voltar</Link>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-600">Carregando...</p> : null}

      {!loading ? (
        <form onSubmit={submit} className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={eventCreatedEnabled} onChange={(e) => setEventCreatedEnabled(e.target.checked)} /> Ao abrir RNC → notificar Qualidade</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={eventUpdatedEnabled} onChange={(e) => setEventUpdatedEnabled(e.target.checked)} /> Após aprovação/atualização relevante → notificar envolvidos conforme regra</label>
          <label className="block text-sm font-medium">Destinatários (1 e-mail por linha)
            <textarea value={recipientText} onChange={(e) => setRecipientText(e.target.value)} className="mt-1 min-h-28 w-full rounded-md border border-slate-300 p-2 text-sm" />
          </label>
          <label className="block text-sm font-medium">Assunto
            <input value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" />
          </label>
          <label className="block text-sm font-medium">Mensagem
            <textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} className="mt-1 min-h-36 w-full rounded-md border border-slate-300 p-2 text-sm" />
          </label>
          <p className="text-xs text-slate-500">Placeholders aceitos: {'{{numeroRnc}}'}, {'{{descricao}}'}, {'{{status}}'}, {'{{responsavel}}'}, {'{{data}}'}.</p>
          <button disabled={saving} className="rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar configuração'}</button>
        </form>
      ) : null}
    </div>
  )
}