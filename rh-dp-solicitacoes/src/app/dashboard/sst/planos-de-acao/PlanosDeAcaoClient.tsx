'use client'

import Link from 'next/link'
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import SstModuleTabs from '@/components/sst/SstModuleTabs'

type PlanStatus = 'ABERTO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO'

type PlanRow = {
  id: string
  numeroPlano: string
  titulo: string
  objetivo?: string | null
  resultadoEsperado?: string | null
  origem?: string | null
  referencia?: string | null
  responsavelNome?: string | null
  dataInicioPrevista?: string | null
  dataFimPrevista?: string | null
  status: PlanStatus
  createdAt: string
  totalAcoes: number
  percentualConcluido: number
  acoesEmAtraso: number
  centroResponsavel?: { description: string } | null
  centroImpactado?: { description: string } | null
}

type ResponsavelOption = {
  id: string
  fullName: string
  email: string
  department?: string | null
}

type PlanForm = {
  titulo: string
  responsavelId: string
  responsavelNome: string
}

const emptyForm: PlanForm = {
  titulo: '',
  responsavelId: '',
  responsavelNome: '',
}

const statusLabel: Record<PlanStatus, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR')
}

function cleanPlanTitle(plan: PlanRow) {
  const raw = plan.titulo || ''
  const number = plan.numeroPlano || ''
  if (number && raw.startsWith(`${number} - `)) {
    return raw.slice(`${number} - `.length).trim()
  }
  if (number && raw.startsWith(`${number} – `)) {
    return raw.slice(`${number} – `.length).trim()
  }
  return raw
}

function responsavelLabel(user: ResponsavelOption) {
  return `${user.fullName} — ${user.email}`
}

export default function PlanosDeAcaoClient() {
  const router = useRouter()
  const [items, setItems] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<PlanForm>(emptyForm)
  const [responsaveis, setResponsaveis] = useState<ResponsavelOption[]>([])
  const [loadingResponsaveis, setLoadingResponsaveis] = useState(false)
  const [responsavelSearch, setResponsavelSearch] = useState('')

  const [numeroPlanoDraft, setNumeroPlanoDraft] = useState('')
  const [tituloDraft, setTituloDraft] = useState('')
  const [responsavelDraft, setResponsavelDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState<'TODOS' | PlanStatus>('TODOS')
  const [emAtrasoDraft, setEmAtrasoDraft] = useState(false)

  const [numeroPlano, setNumeroPlano] = useState('')
  const [titulo, setTitulo] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [status, setStatus] = useState<'TODOS' | PlanStatus>('TODOS')
  const [emAtraso, setEmAtraso] = useState(false)

  async function load() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      const q = [numeroPlano, titulo].filter(Boolean).join(' ').trim()
      if (q) params.set('numeroProcesso', q)
      if (responsavel.trim()) params.set('responsavel', responsavel.trim())
      if (status !== 'TODOS') params.set('status', status)
      if (emAtraso) params.set('emAtraso', '1')

      const res = await fetch(`/api/sst/planos-de-acao?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar planos avulsos.')

      setItems(Array.isArray(data.items) ? data.items : [])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar planos avulsos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [numeroPlano, titulo, responsavel, status, emAtraso])

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    setNumeroPlano(numeroPlanoDraft)
    setTitulo(tituloDraft)
    setResponsavel(responsavelDraft)
    setStatus(statusDraft)
    setEmAtraso(emAtrasoDraft)
  }

  function clearFilters() {
    setNumeroPlanoDraft('')
    setTituloDraft('')
    setResponsavelDraft('')
    setStatusDraft('TODOS')
    setEmAtrasoDraft(false)
    setNumeroPlano('')
    setTitulo('')
    setResponsavel('')
    setStatus('TODOS')
    setEmAtraso(false)
  }

  async function loadResponsaveis() {
    try {
      setLoadingResponsaveis(true)
      const res = await fetch('/api/sst/planos-de-acao/responsaveis', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar responsáveis.')
      const users = Array.isArray(data.users) ? data.users : []
      setResponsaveis(users)
    } catch {
      setResponsaveis([])
    } finally {
      setLoadingResponsaveis(false)
    }
  }

  useEffect(() => {
    if (modalOpen) loadResponsaveis()
  }, [modalOpen])

  function selectResponsavelByLabel(label: string) {
    setResponsavelSearch(label)
    const responsavel = responsaveis.find((user) => responsavelLabel(user) === label)
    setForm((prev) => ({
      ...prev,
      responsavelId: responsavel?.id || '',
      responsavelNome: responsavel?.fullName || '',
    }))
  }

  async function createPlan(e: FormEvent) {
    e.preventDefault()
    setCreateError(null)

    try {
      setCreating(true)
      const res = await fetch('/api/sst/planos-de-acao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: form.titulo,
          responsavelId: form.responsavelId || null,
          responsavelNome: form.responsavelNome,
          status: 'ABERTO',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao registrar plano.')

      const plan = data?.item || data
      const planId = plan?.id
      if (!planId) throw new Error('Plano criado sem identificador.')

      const actionRes = await fetch(`/api/sst/planos-de-acao/${planId}/acoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao: form.titulo,
          responsavelId: form.responsavelId || null,
          responsavelNome: form.responsavelNome,
          origemPlano: 'PLANO_AVULSO',
          qualityActionPlanId: planId,
          nonConformityId: null,
          status: 'PENDENTE',
          origem: 'PLANO AVULSO',
          referencia: plan?.numeroPlano,
        }),
      })
      const actionData = await actionRes.json().catch(() => ({}))
      if (!actionRes.ok) throw new Error(actionData?.error || 'Erro ao criar primeira ação do plano.')
      const action = actionData?.item || actionData
      const actionId = action?.id
      if (!actionId) throw new Error('Ação criada sem identificador.')

      setModalOpen(false)
      setForm(emptyForm)
      setResponsavelSearch('')
      router.push(`/dashboard/sgi/qualidade/planos-de-acao/${planId}/acoes/${actionId}`)
    } catch (e: any) {
      setCreateError(e?.message || 'Erro ao registrar plano.')
    } finally {
      setCreating(false)
    }
  }

  async function deletePlan(plan: PlanRow) {
    if (!window.confirm(`Deseja excluir ou cancelar o plano ${plan.numeroPlano}?`)) return

    try {
      const res = await fetch(`/api/sst/planos-de-acao/${plan.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao excluir/cancelar plano.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao excluir/cancelar plano.')
    }
  }

  const rows = useMemo(() => items, [items])

  return (
    <div className="space-y-5">
      <SstModuleTabs active="planos-de-acao" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase text-slate-500">SGI / Qualidade</p>
          <h1 className="text-3xl font-bold text-slate-900">Planos de ação avulsos</h1>
          <p className="max-w-3xl text-slate-600">Visualize os planos avulsos e acompanhe as ações vinculadas.</p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
          Registrar plano de ação
        </button>
      </div>

      <form onSubmit={handleSearch} className="app-card space-y-4">
        <header>
          <h2 className="text-sm font-semibold">Filtros</h2>
          <p className="text-xs app-muted-text">Pesquise por dados do plano pai, não por ações individuais.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Nº Plano">
            <input value={numeroPlanoDraft} onChange={(e) => setNumeroPlanoDraft(e.target.value)} className="app-input min-h-10" placeholder="PA-2026-0001" />
          </Field>
          <Field label="Título">
            <input value={tituloDraft} onChange={(e) => setTituloDraft(e.target.value)} className="app-input min-h-10" placeholder="Título do plano" />
          </Field>
          <Field label="Responsável">
            <input value={responsavelDraft} onChange={(e) => setResponsavelDraft(e.target.value)} className="app-input min-h-10" placeholder="Nome do responsável" />
          </Field>
          <Field label="Status">
            <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value as 'TODOS' | PlanStatus)} className="app-select min-h-10">
              <option value="TODOS">Todos</option>
              {Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </Field>
          <Field label="Em atraso">
            <label className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm">
              <input type="checkbox" checked={emAtrasoDraft} onChange={(e) => setEmAtrasoDraft(e.target.checked)} />
              Planos com ações em atraso
            </label>
          </Field>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="app-button-primary">Pesquisar</button>
          <button type="button" onClick={clearFilters} className="app-button-secondary">Limpar filtros</button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Nº Plano</th>
              <th className="px-3 py-2">Título</th>
              <th className="px-3 py-2">Responsável</th>
              <th className="px-3 py-2">Centro responsável</th>
              <th className="px-3 py-2">Centro impactado</th>
              <th className="px-3 py-2">Prazo</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Qtde de ações</th>
              <th className="px-3 py-2">% concluído</th>
              <th className="px-3 py-2">Ações em atraso</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((plan) => (
              <tr key={plan.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-900">{plan.numeroPlano}</td>
                <td className="px-3 py-2 text-slate-700">{cleanPlanTitle(plan)}</td>
                <td className="px-3 py-2 text-slate-700">{plan.responsavelNome || '-'}</td>
                <td className="px-3 py-2 text-slate-700">{plan.centroResponsavel?.description || '-'}</td>
                <td className="px-3 py-2 text-slate-700">{plan.centroImpactado?.description || '-'}</td>
                <td className="px-3 py-2 text-slate-700">{formatDate(plan.dataFimPrevista)}</td>
                <td className="px-3 py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{statusLabel[plan.status]}</span></td>
                <td className="px-3 py-2 text-slate-700">{plan.totalAcoes}</td>
                <td className="px-3 py-2 text-slate-700">{plan.percentualConcluido}%</td>
                <td className="px-3 py-2 font-medium text-rose-700">{plan.acoesEmAtraso}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Link href={`/dashboard/sgi/qualidade/planos-de-acao/${plan.id}`} className="rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-700">
                      Exibir / Editar
                    </Link>
                    <button type="button" onClick={() => deletePlan(plan)} className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700">
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-sm text-slate-500">Nenhum plano avulso encontrado.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {loading ? <p className="text-sm text-slate-600">Carregando planos...</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={createPlan} className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Registrar plano de ação</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded border px-2 py-1 text-sm">Fechar</button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <Field label="Título *"><input required value={form.titulo} onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))} className="app-input min-h-10 w-full" /></Field>
              <Field label="Responsável">
                <input
                  list="responsaveis-plano-avulso"
                  value={responsavelSearch}
                  onChange={(e) => selectResponsavelByLabel(e.target.value)}
                  className="app-input min-h-10 w-full"
                  placeholder={loadingResponsaveis ? 'Carregando responsáveis...' : 'Pesquise por nome ou e-mail'}
                />
                <datalist id="responsaveis-plano-avulso">
                  {responsaveis.map((user) => (
                    <option key={user.id} value={responsavelLabel(user)} />
                  ))}
                </datalist>
                {!loadingResponsaveis && responsaveis.length === 0 ? <p className="mt-1 text-xs text-slate-500">Nenhum responsável encontrado.</p> : null}
              </Field>
              {createError ? <p className="md:col-span-2 text-sm text-rose-700">{createError}</p> : null}
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button type="button" onClick={() => setModalOpen(false)} className="app-button-secondary">Cancelar</button>
              <button type="submit" disabled={creating} className="app-button-primary">{creating ? 'Registrando...' : 'Registrar'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      <span className="app-label">{label}</span>
      <div>{children}</div>
    </label>
  )
}
