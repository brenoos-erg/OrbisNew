'use client'

import Link from 'next/link'
import { NonConformityActionStatus } from '@prisma/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type CostCenter = { id: string; code: string; description: string }
type Gestor = { id: string; userId: string; user: { id: string; fullName: string | null; email: string } }

function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : ''
}

function toCostCenterLabel(center?: CostCenter | null) {
  if (!center) return ''
  return `${center.code} - ${center.description}`
}

export default function PlanoAvulsoDetailClient({ actionId }: { actionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [gestores, setGestores] = useState<Gestor[]>([])

  const [descricao, setDescricao] = useState('')
  const [centroImpactadoId, setCentroImpactadoId] = useState('')
  const [centroResponsavelId, setCentroResponsavelId] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [responsavelNome, setResponsavelNome] = useState('')
  const [custo, setCusto] = useState('')
  const [status, setStatus] = useState<NonConformityActionStatus>(NonConformityActionStatus.PENDENTE)
  const [evidencias, setEvidencias] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [res, centersRes, gestoresRes] = await Promise.all([
          fetch(`/api/sst/plano-de-acao/${actionId}`, { cache: 'no-store' }),
          fetch('/api/cost-centers/select', { cache: 'no-store' }),
          fetch('/api/configuracoes/gestores', { cache: 'no-store' }),
        ])
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar plano.')
        if (centersRes.ok) setCostCenters(await centersRes.json())
        if (gestoresRes.ok) {
          const gestoresData = await gestoresRes.json().catch(() => ({}))
          setGestores(gestoresData.members ?? [])
        }

        const item = data.item
        setDescricao(item.descricao || '')
        setCentroImpactadoId(item.centroImpactadoId || '')
        setCentroResponsavelId(item.centroResponsavelId || '')
        setResponsavelId(item.responsavelId || '')
        setResponsavelNome(item.responsavelNome || '')
        setCusto(item.custo != null ? String(item.custo) : '')
        setStatus(item.status || NonConformityActionStatus.PENDENTE)
        setEvidencias(item.evidencias || '')
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar plano.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [actionId])

  async function uploadEvidence(file: File) {
    const body = new FormData()
    body.set('file', file)
    const res = await fetch('/api/uploads?scope=plano-acao-avulso', { method: 'POST', body })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.url) throw new Error(data?.error || 'Falha no upload do arquivo.')
    setEvidencias((prev) => `${prev ? `${prev}\n` : ''}${data.url}`)
  }

  async function save(nextStatus?: NonConformityActionStatus) {
    try {
      const desiredStatus = nextStatus ?? status
      if (desiredStatus === NonConformityActionStatus.CONCLUIDA && !evidencias.trim()) {
        throw new Error('A ação só pode ser concluída com evidência anexada.')
      }
      setSaving(true)
      const selectedGestor = gestores.find((g) => g.userId === responsavelId)
      const res = await fetch(`/api/sst/plano-de-acao/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao,
          centroImpactadoId: centroImpactadoId || null,
          centroResponsavelId: centroResponsavelId || null,
          responsavelId: responsavelId || null,
          responsavelNome: selectedGestor?.user.fullName || responsavelNome || null,
          custo: custo || null,
          status: desiredStatus,
          dataConclusao: desiredStatus === NonConformityActionStatus.CONCLUIDA ? toDateInput(new Date().toISOString()) : null,
          evidencias,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar plano.')
      setStatus(desiredStatus)
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar plano.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-600">Carregando plano...</p>

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm uppercase text-slate-500">Plano de ação avulso</p>
          <h1 className="text-2xl font-bold text-slate-900">{descricao || `Plano ${actionId.slice(-6)}`}</h1>
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => save(NonConformityActionStatus.CONCLUIDA)} disabled={saving} className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Concluir ação</button>
          <button onClick={() => save()} disabled={saving} className="rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white">Salvar/Atualizar</button>
          <Link href="/dashboard/sgi/qualidade/planos-de-acao" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Voltar</Link>
        </div>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <label className="block text-sm font-medium text-slate-700">Título da ação
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">Centro impactado
            <select value={centroImpactadoId} onChange={(e) => setCentroImpactadoId(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {costCenters.map((cc) => (<option key={cc.id} value={cc.id}>{toCostCenterLabel(cc)}</option>))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Centro responsável
            <select value={centroResponsavelId} onChange={(e) => setCentroResponsavelId(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {costCenters.map((cc) => (<option key={cc.id} value={cc.id}>{toCostCenterLabel(cc)}</option>))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Responsáveis (gestores)
            <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {gestores.map((g) => <option key={g.id} value={g.userId}>{g.user.fullName || g.user.email}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Recurso financeiro
            <input type="number" step="0.01" value={custo} onChange={(e) => setCusto(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </div>

        <label className="block text-sm font-medium">Evidências (links/observações)
          <textarea value={evidencias} onChange={(e) => setEvidencias(e.target.value)} rows={6} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadEvidence(f).catch((err) => setError(err.message)) }} className="text-sm" />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}