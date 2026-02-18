'use client'

import Link from 'next/link'
import { NonConformityActionStatus } from '@prisma/client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { actionStatusLabel } from '@/lib/sst/serializers'

type ActionRow = {
  id: string
  descricao: string
  responsavelNome?: string | null
  prazo?: string | null
  status: NonConformityActionStatus
  createdAt: string
  nonConformityId: string
  nonConformity: {
    id: string
    numeroRnc: string
    centroQueOriginou?: { description: string } | null
    centroQueDetectou?: { description: string } | null
  }
}

function toDateOnly(dateValue?: string | null) {
  if (!dateValue) return null
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isOverdue(action: ActionRow) {
  const prazo = toDateOnly(action.prazo)
  if (!prazo) return false
  if (action.status === NonConformityActionStatus.CONCLUIDA || action.status === NonConformityActionStatus.CANCELADA) return false

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return prazo < today
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR')
}

const ACTION_STATUS_FILTER_OPTIONS = ['TODOS', ...Object.values(NonConformityActionStatus)] as const

type FilterStatus = (typeof ACTION_STATUS_FILTER_OPTIONS)[number]

export default function PlanosDeAcaoClient() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ActionRow[]>([])

  const [qDraft, setQDraft] = useState('')
  const [responsavelDraft, setResponsavelDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState<FilterStatus>('TODOS')
  const [emAtrasoDraft, setEmAtrasoDraft] = useState(false)

  const [q, setQ] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [status, setStatus] = useState<FilterStatus>('TODOS')
  const [emAtraso, setEmAtraso] = useState(false)

  async function load() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (responsavel.trim()) params.set('responsavel', responsavel.trim())
      if (status !== 'TODOS') params.set('status', status)
      if (emAtraso) params.set('emAtraso', '1')

      const res = await fetch(`/api/sst/plano-de-acao?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar planos de ação.')

      setItems(Array.isArray(data.items) ? data.items : [])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar planos de ação.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [q, responsavel, status, emAtraso])

  const totalAtrasadas = useMemo(() => items.filter((item) => isOverdue(item)).length, [items])

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    setQ(qDraft)
    setResponsavel(responsavelDraft)
    setStatus(statusDraft)
    setEmAtraso(emAtrasoDraft)
  }

  function limparFiltros() {
    setQDraft('')
    setResponsavelDraft('')
    setStatusDraft('TODOS')
    setEmAtrasoDraft(false)
    setQ('')
    setResponsavel('')
    setStatus('TODOS')
    setEmAtraso(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <p className="text-sm font-semibold uppercase text-slate-500">Não Conformidades</p>
          <h1 className="text-3xl font-bold text-slate-900">Planos de ação</h1>
          <p className="max-w-3xl text-slate-600">Visualize todos os planos registrados e clique em um item para abrir a tela completa do plano.</p>
        </div>
        <Link href="/dashboard/sst/nao-conformidades" className="ml-auto rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Voltar para não conformidades
        </Link>
      </div>

      <form onSubmit={handleSearch} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            Buscar
            <input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="Nº RNC, descrição ou evidência"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Responsável
            <input
              value={responsavelDraft}
              onChange={(e) => setResponsavelDraft(e.target.value)}
              placeholder="Nome do responsável"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Status
            <select
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value as FilterStatus)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {ACTION_STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'TODOS' ? 'Todos' : actionStatusLabel[option]}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={emAtrasoDraft}
              onChange={(e) => setEmAtrasoDraft(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Somente em atraso
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="rounded bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600">Pesquisar</button>
          <button type="button" onClick={limparFiltros} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Limpar filtros</button>
        </div>
      </form>

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Total de planos" value={String(items.length)} />
        <StatCard label="Em atraso" value={String(totalAtrasadas)} />
        <StatCard
          label="Concluídas"
          value={String(items.filter((item) => item.status === NonConformityActionStatus.CONCLUIDA).length)}
        />
      </section>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Nº processo</th>
              <th className="px-3 py-2">Data criação</th>
              <th className="px-3 py-2">Prazo</th>
              <th className="px-3 py-2">O quê</th>
              <th className="px-3 py-2">Centro responsável</th>
              <th className="px-3 py-2">Responsável</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const atrasada = isOverdue(item)
              return (
                <tr key={item.id} className="border-t border-slate-100 hover:bg-orange-50/60">
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${atrasada ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                      {atrasada ? 'Em atraso' : actionStatusLabel[item.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.nonConformity?.numeroRnc || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDate(item.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDate(item.prazo)}</td>
                  <td className="px-3 py-2 text-slate-700">{item.descricao}</td>
                  <td className="px-3 py-2 text-slate-700">{item.nonConformity?.centroQueOriginou?.description || item.nonConformity?.centroQueDetectou?.description || '-'}</td>
                  <td className="px-3 py-2 text-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <span>{item.responsavelNome || '-'}</span>
                      <Link
                        href={`/dashboard/sst/nao-conformidades/${item.nonConformityId}?section=planoDeAcao&actionId=${item.id}`}
                        className="rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-700"
                      >
                        Abrir plano
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">Nenhum plano de ação encontrado com os filtros atuais.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {loading ? <p className="text-sm text-slate-600">Carregando planos de ação...</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </article>
  )
}