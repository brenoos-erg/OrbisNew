'use client'

import Link from 'next/link'
import { NonConformityActionStatus } from '@prisma/client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import GutRadarCard from '@/components/sst/GutRadarCard'
import { actionStatusLabel } from '@/lib/sst/serializers'

type DetailPayload = {
  action: {
    id: string
    descricao: string
    responsavelNome?: string | null
    prazo?: string | null
    status: NonConformityActionStatus
    evidencias?: string | null
    createdAt: string
    updatedAt: string
  }
  nonConformity: {
    id: string
    numeroRnc: string
    gravidade?: number | null
    urgencia?: number | null
    tendencia?: number | null
    aprovadoQualidadeStatus: string
    createdAt: string
    updatedAt: string
    solicitante?: { fullName?: string | null; email?: string | null } | null
  }
  editable: boolean
  timeline: Array<{ id: string; createdAt: string; message?: string | null; tipo: string; actor?: { fullName?: string | null } | null }>
}

type TabKey = 'dados' | 'evidencias'

const ACTION_STATUS_OPTIONS = Object.values(NonConformityActionStatus)

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR')
}

export default function AcaoNaoConformidadeDetailClient({ id, actionId }: { id: string; actionId: string }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('dados')
  const [item, setItem] = useState<DetailPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const [descricao, setDescricao] = useState('')
  const [responsavelNome, setResponsavelNome] = useState('')
  const [prazo, setPrazo] = useState('')
  const [status, setStatus] = useState<NonConformityActionStatus>(NonConformityActionStatus.PENDENTE)
  const [evidencias, setEvidencias] = useState('')

  async function load() {
    try {
      setLoading(true)
      const res = await fetch(`/api/sst/nao-conformidades/${id}/plano-de-acao/${actionId}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar ação.')
      const payload: DetailPayload = data.item
      setItem(payload)
      setDescricao(payload.action.descricao || '')
      setResponsavelNome(payload.action.responsavelNome || '')
      setPrazo(payload.action.prazo ? payload.action.prazo.slice(0, 10) : '')
      setStatus(payload.action.status)
      setEvidencias(payload.action.evidencias || '')
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar ação.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id, actionId])

  const readOnly = useMemo(() => !item?.editable, [item?.editable])

  async function patchAction(partial: Partial<{ descricao: string; responsavelNome: string; prazo: string | null; status: NonConformityActionStatus; evidencias: string }>) {
    if (readOnly) return

    setSaving(true)
    try {
      const res = await fetch(`/api/sst/nao-conformidades/${id}/plano-de-acao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: actionId,
          descricao,
          responsavelNome,
          prazo: prazo || null,
          status,
          evidencias,
          ...partial,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao atualizar ação.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar ação.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await patchAction({})
  }

  async function handleCancelAction() {
    await patchAction({ status: NonConformityActionStatus.CANCELADA })
  }

  async function handleConcludeAction() {
    await patchAction({ status: NonConformityActionStatus.CONCLUIDA })
  }

  async function handleReopenAction() {
    const target = status === NonConformityActionStatus.CONCLUIDA ? NonConformityActionStatus.EM_ANDAMENTO : NonConformityActionStatus.PENDENTE
    await patchAction({ status: target })
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || readOnly) return
    const form = new FormData()
    Array.from(files).forEach((f) => form.append('files', f))
    setUploading(true)
    await fetch(`/api/sst/nao-conformidades/${id}/anexos`, { method: 'POST', body: form })
    setUploading(false)
    await load()
  }

  if (loading && !item) return <p className="text-sm text-slate-600">Carregando ação...</p>
  if (error && !item) return <p className="text-sm text-rose-700">{error}</p>
  if (!item) return null

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start gap-3">
        <div>
          <p className="text-sm uppercase text-slate-500">Ação</p>
          <h1 className="text-2xl font-bold text-slate-900">Ação</h1>
          <p className="text-sm text-slate-600">Nº RNC: {item.nonConformity.numeroRnc}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={handleCancelAction} disabled={readOnly || saving} className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleReopenAction} disabled={readOnly || saving} className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 disabled:opacity-50">Reabrir</button>
          <button type="button" onClick={handleConcludeAction} disabled={readOnly || saving} className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50">Concluir Ação</button>
          <button type="submit" form="form-acao-nc" disabled={readOnly || saving} className="rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Atualizando...' : 'Salvar/Atualizar'}</button>
          <button type="button" onClick={() => router.push(`/dashboard/sst/nao-conformidades/${id}?section=planoDeAcao`)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Sair</button>
        </div>
      </header>

      {readOnly ? <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">Ação em modo somente leitura. A NC ainda não foi aprovada pela qualidade ou você não possui permissão de edição.</div> : null}
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveTab('dados')} className={`rounded-md px-3 py-2 text-sm font-medium ${activeTab === 'dados' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Ação - Dados Básicos</button>
          <button type="button" onClick={() => setActiveTab('evidencias')} className={`rounded-md px-3 py-2 text-sm font-medium ${activeTab === 'evidencias' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Evidências</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {activeTab === 'dados' ? (
            <form id="form-acao-nc" onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                <strong>Nº Processo:</strong> {item.nonConformity.numeroRnc} &nbsp; | &nbsp;
                <strong>Criado em:</strong> {formatDateTime(item.action.createdAt)} &nbsp; | &nbsp;
                <strong>Criado por:</strong> {item.nonConformity.solicitante?.fullName || item.nonConformity.solicitante?.email || '-'} &nbsp; | &nbsp;
                <strong>Última atualização:</strong> {formatDateTime(item.action.updatedAt)}
              </div>

              <label className="block space-y-1 text-sm font-medium text-slate-700">O quê
                <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={readOnly || saving} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm font-medium text-slate-700">Responsável
                  <input value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} disabled={readOnly || saving} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">Prazo / Quando até
                  <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} disabled={readOnly || saving} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                </label>
              </div>

              <label className="space-y-1 text-sm font-medium text-slate-700">Status
                <select value={status} onChange={(e) => setStatus(e.target.value as NonConformityActionStatus)} disabled={readOnly || saving} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal">
                  {ACTION_STATUS_OPTIONS.map((option) => (<option key={option} value={option}>{actionStatusLabel[option]}</option>))}
                </select>
              </label>

              <label className="block space-y-1 text-sm font-medium text-slate-700">Histórico/Observações
                <textarea value={evidencias} onChange={(e) => setEvidencias(e.target.value)} disabled={readOnly || saving} rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
              </label>

              <section className="space-y-2 rounded-md border border-slate-200 p-3">
                <h3 className="text-sm font-semibold text-slate-800">Histórico da ação</h3>
                {item.timeline.length ? (
                  <ul className="max-h-56 space-y-2 overflow-auto text-sm">
                    {item.timeline.map((t) => (
                      <li key={t.id} className="rounded border border-slate-200 p-2">
                        <p className="text-xs text-slate-500">{formatDateTime(t.createdAt)} · {t.actor?.fullName || 'Sistema'}</p>
                        <p className="text-slate-700">{t.message || t.tipo}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Sem eventos relacionados a esta ação.</p>
                )}
              </section>
            </form>
          ) : (
            <div className="space-y-4">
              <label className="block space-y-1 text-sm font-medium text-slate-700">Evidências (texto)
                <textarea value={evidencias} onChange={(e) => setEvidencias(e.target.value)} disabled={readOnly || saving} rows={8} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
              </label>
              <label className="block space-y-1 text-sm font-medium text-slate-700">Upload de anexos (reutiliza anexos da NC)
                <input type="file" multiple disabled={readOnly || uploading} onChange={(e) => uploadFiles(e.target.files)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <p className="text-xs text-slate-500">{uploading ? 'Enviando evidências...' : 'Os anexos enviados ficam vinculados à não conformidade.'}</p>
              <button type="button" onClick={() => patchAction({ evidencias })} disabled={readOnly || saving} className="rounded bg-orange-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar evidências</button>
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <GutRadarCard
            gravidade={Number(item.nonConformity.gravidade) || 1}
            urgencia={Number(item.nonConformity.urgencia) || 1}
            tendencia={Number(item.nonConformity.tendencia) || 1}
          />
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <p><strong>Status ação:</strong> {actionStatusLabel[item.action.status]}</p>
            <p><strong>Status aprovação qualidade:</strong> {item.nonConformity.aprovadoQualidadeStatus}</p>
            <p className="mt-2"><Link href={`/dashboard/sst/nao-conformidades/${id}`} className="text-orange-600 hover:underline">Abrir não conformidade</Link></p>
          </div>
        </aside>
      </div>
    </div>
  )
}