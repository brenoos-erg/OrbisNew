'use client'

import Link from 'next/link'
import { NonConformityActionStatus } from '@prisma/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { actionStatusLabel } from '@/lib/sst/serializers'

export default function PlanoAvulsoDetailClient({ actionId }: { actionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [descricao, setDescricao] = useState('')
  const [responsavelNome, setResponsavelNome] = useState('')
  const [prazo, setPrazo] = useState('')
  const [status, setStatus] = useState<NonConformityActionStatus>(NonConformityActionStatus.PENDENTE)
  const [evidencias, setEvidencias] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const res = await fetch(`/api/sst/plano-de-acao/${actionId}`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar plano.')

        const item = data?.item
        if (!item) throw new Error('Plano não encontrado.')

        setDescricao(item.descricao || '')
        setResponsavelNome(item.responsavelNome || '')
        setPrazo(item.prazo ? String(item.prazo).slice(0, 10) : '')
        setStatus(item.status || NonConformityActionStatus.PENDENTE)
        setEvidencias(item.evidencias || '')
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar plano.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [actionId])

  async function save() {
    try {
      setSaving(true)
      const res = await fetch(`/api/sst/plano-de-acao/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao, responsavelNome, prazo: prazo || null, status, evidencias }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar plano.')
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar plano.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm('Deseja excluir este plano avulso?')) return
    const res = await fetch(`/api/sst/plano-de-acao/${actionId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/dashboard/sst/planos-de-acao')
      return
    }
    const data = await res.json().catch(() => ({}))
    setError(data?.error || 'Erro ao excluir plano.')
  }

  if (loading) return <p className="text-sm text-slate-600">Carregando plano...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Plano de ação avulso</h1>
        <Link href="/dashboard/sst/planos-de-acao" className="rounded border border-slate-300 px-3 py-2 text-sm">Voltar</Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium">Descrição
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-sm font-medium">Responsável
            <input value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium">Prazo
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium">Status
            <select value={status} onChange={(e) => setStatus(e.target.value as NonConformityActionStatus)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {Object.values(NonConformityActionStatus).map((option) => (
                <option key={option} value={option}>{actionStatusLabel[option]}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">Evidências
          <textarea value={evidencias} onChange={(e) => setEvidencias(e.target.value)} rows={6} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>

        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="rounded bg-orange-500 px-3 py-2 text-sm font-semibold text-white">Salvar</button>
          <button onClick={remove} type="button" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Excluir</button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}