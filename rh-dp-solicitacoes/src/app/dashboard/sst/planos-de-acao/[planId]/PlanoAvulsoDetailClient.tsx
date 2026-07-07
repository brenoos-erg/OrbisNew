'use client'

import Link from 'next/link'
import { FormEvent, ReactNode, useEffect, useState } from 'react'

type PlanStatus = 'ABERTO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO'
type ActionStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA'

type Plan = {
  id: string
  numeroPlano: string
  titulo: string
  objetivo?: string | null
  resultadoEsperado?: string | null
  origem?: string | null
  referencia?: string | null
  responsavelNome?: string | null
  status: PlanStatus
  dataInicioPrevista?: string | null
  dataFimPrevista?: string | null
  dataConclusao?: string | null
  investimento?: string | number | null
  totalAcoes: number
  acoesConcluidas: number
  acoesEmAndamento: number
  acoesPendentes: number
  acoesCanceladas: number
  acoesEmAtraso: number
  percentualConcluido: number
  createdAt: string
  updatedAt: string
  centroResponsavel?: { description: string } | null
  centroImpactado?: { description: string } | null
}

type PlanAction = {
  id: string
  descricao: string
  motivoBeneficio?: string | null
  atividadeComo?: string | null
  origem?: string | null
  responsavelNome?: string | null
  prazo?: string | null
  status: ActionStatus
  rapidez?: number | null
  autonomia?: number | null
  beneficio?: number | null
  evidencias?: string | null
  centroResponsavel?: { description: string } | null
  centroImpactado?: { description: string } | null
}

type ActionForm = {
  id?: string
  descricao: string
  motivoBeneficio: string
  atividadeComo: string
  origem: string
  responsavelNome: string
  prazo: string
  status: ActionStatus
  rapidez: string
  autonomia: string
  beneficio: string
  evidencias: string
}

const emptyActionForm: ActionForm = {
  descricao: '',
  motivoBeneficio: '',
  atividadeComo: '',
  origem: '',
  responsavelNome: '',
  prazo: '',
  status: 'PENDENTE',
  rapidez: '',
  autonomia: '',
  beneficio: '',
  evidencias: '',
}

const planStatusLabel: Record<PlanStatus, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
}

const actionStatusLabel: Record<ActionStatus, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR')
}

function dateInputValue(value?: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

function priorityScore(action: PlanAction) {
  return (action.rapidez || 0) + (action.autonomia || 0) + (action.beneficio || 0)
}

export default function PlanoAvulsoDetailClient({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [actions, setActions] = useState<PlanAction[]>([])
  const [tab, setTab] = useState<'dados' | 'acoes' | 'evidencias' | 'historico'>('dados')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [actionForm, setActionForm] = useState<ActionForm>(emptyActionForm)

  async function load() {
    try {
      setLoading(true)
      const [planRes, actionsRes] = await Promise.all([
        fetch(`/api/sst/planos-de-acao/${planId}`, { cache: 'no-store' }),
        fetch(`/api/sst/planos-de-acao/${planId}/acoes`, { cache: 'no-store' }),
      ])
      const planData = await planRes.json().catch(() => ({}))
      const actionsData = await actionsRes.json().catch(() => ({}))

      if (planRes.redirected) {
        window.location.href = planRes.url
        return
      }
      if (!planRes.ok) throw new Error(planData?.error || 'Erro ao carregar plano.')
      if (!actionsRes.ok) throw new Error(actionsData?.error || 'Erro ao carregar ações do plano.')

      setPlan(planData.item)
      setActions(Array.isArray(actionsData.items) ? actionsData.items : [])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar plano avulso.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [planId])

  async function savePlan(nextStatus?: PlanStatus) {
    if (!plan) return
    try {
      setSaving(true)
      const res = await fetch(`/api/sst/planos-de-acao/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: plan.titulo,
          objetivo: plan.objetivo,
          resultadoEsperado: plan.resultadoEsperado,
          origem: plan.origem,
          referencia: plan.referencia,
          responsavelNome: plan.responsavelNome,
          dataInicioPrevista: plan.dataInicioPrevista || null,
          dataFimPrevista: plan.dataFimPrevista || null,
          dataConclusao: plan.dataConclusao || null,
          investimento: plan.investimento || null,
          status: nextStatus || plan.status,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao atualizar plano.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar plano.')
    } finally {
      setSaving(false)
    }
  }

  function openNewAction() {
    setActionForm(emptyActionForm)
    setActionModalOpen(true)
  }

  function openEditAction(action: PlanAction) {
    setActionForm({
      id: action.id,
      descricao: action.descricao || '',
      motivoBeneficio: action.motivoBeneficio || '',
      atividadeComo: action.atividadeComo || '',
      origem: action.origem || '',
      responsavelNome: action.responsavelNome || '',
      prazo: dateInputValue(action.prazo),
      status: action.status,
      rapidez: action.rapidez ? String(action.rapidez) : '',
      autonomia: action.autonomia ? String(action.autonomia) : '',
      beneficio: action.beneficio ? String(action.beneficio) : '',
      evidencias: action.evidencias || '',
    })
    setActionModalOpen(true)
  }

  async function saveAction(e: FormEvent) {
    e.preventDefault()
    const url = actionForm.id
      ? `/api/sst/planos-de-acao/${planId}/acoes/${actionForm.id}`
      : `/api/sst/planos-de-acao/${planId}/acoes`

    try {
      const res = await fetch(url, {
        method: actionForm.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao: actionForm.descricao,
          motivoBeneficio: actionForm.motivoBeneficio,
          atividadeComo: actionForm.atividadeComo,
          origem: actionForm.origem,
          responsavelNome: actionForm.responsavelNome,
          prazo: actionForm.prazo || null,
          status: actionForm.status,
          rapidez: actionForm.rapidez || null,
          autonomia: actionForm.autonomia || null,
          beneficio: actionForm.beneficio || null,
          evidencias: actionForm.evidencias,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar ação.')
      setActionModalOpen(false)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar ação.')
    }
  }

  async function deleteAction(action: PlanAction) {
    if (!window.confirm('Deseja excluir esta ação do plano?')) return
    try {
      const res = await fetch(`/api/sst/planos-de-acao/${planId}/acoes/${action.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao excluir ação.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao excluir ação.')
    }
  }

  if (!plan) return <div className="app-card">{loading ? 'Carregando plano avulso...' : error || 'Plano avulso não encontrado.'}</div>

  return (
    <div className="space-y-5">
      <div className="app-card flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase text-slate-500">Plano de ação avulso</p>
          <h1 className="text-2xl font-bold text-slate-900">{plan.numeroPlano} · {plan.titulo}</h1>
          <p className="text-slate-600">Status: {planStatusLabel[plan.status]} · Responsável: {plan.responsavelNome || '-'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => savePlan()} disabled={saving} className="app-button-primary">Salvar/Atualizar</button>
          <button type="button" onClick={() => savePlan('CANCELADO')} disabled={saving} className="app-button-secondary">Cancelar plano</button>
          <button type="button" onClick={() => savePlan('CONCLUIDO')} disabled={saving} className="app-button-secondary">Concluir plano</button>
          <Link href="/dashboard/sgi/qualidade/planos-de-acao" className="app-button-secondary">Sair/Voltar</Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Total de ações" value={plan.totalAcoes} />
        <SummaryCard label="Concluídas" value={plan.acoesConcluidas} />
        <SummaryCard label="Em andamento" value={plan.acoesEmAndamento} />
        <SummaryCard label="Pendentes" value={plan.acoesPendentes} />
        <SummaryCard label="Em atraso" value={plan.acoesEmAtraso} />
        <SummaryCard label="% concluído" value={`${plan.percentualConcluido}%`} />
      </div>

      <div className="app-card">
        <div className="mb-4 flex flex-wrap gap-2">
          <TabButton active={tab === 'dados'} onClick={() => setTab('dados')}>Dados do plano</TabButton>
          <TabButton active={tab === 'acoes'} onClick={() => setTab('acoes')}>Ações do plano</TabButton>
          <TabButton active={tab === 'evidencias'} onClick={() => setTab('evidencias')}>Evidências</TabButton>
          <TabButton active={tab === 'historico'} onClick={() => setTab('historico')}>Histórico</TabButton>
        </div>

        {tab === 'dados' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Número do plano"><input className="app-input w-full" value={plan.numeroPlano} readOnly /></Field>
            <Field label="Título"><input className="app-input w-full" value={plan.titulo} onChange={(e) => setPlan({ ...plan, titulo: e.target.value })} /></Field>
            <Field label="Origem"><input className="app-input w-full" value={plan.origem || ''} onChange={(e) => setPlan({ ...plan, origem: e.target.value })} /></Field>
            <Field label="Referência"><input className="app-input w-full" value={plan.referencia || ''} onChange={(e) => setPlan({ ...plan, referencia: e.target.value })} /></Field>
            <Field label="Responsável"><input className="app-input w-full" value={plan.responsavelNome || ''} onChange={(e) => setPlan({ ...plan, responsavelNome: e.target.value })} /></Field>
            <Field label="Status"><select className="app-select w-full" value={plan.status} onChange={(e) => setPlan({ ...plan, status: e.target.value as PlanStatus })}>{Object.entries(planStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
            <Field label="Início previsto"><input type="date" className="app-input w-full" value={dateInputValue(plan.dataInicioPrevista)} onChange={(e) => setPlan({ ...plan, dataInicioPrevista: e.target.value })} /></Field>
            <Field label="Fim previsto"><input type="date" className="app-input w-full" value={dateInputValue(plan.dataFimPrevista)} onChange={(e) => setPlan({ ...plan, dataFimPrevista: e.target.value })} /></Field>
            <Field label="Data conclusão"><input type="date" className="app-input w-full" value={dateInputValue(plan.dataConclusao)} onChange={(e) => setPlan({ ...plan, dataConclusao: e.target.value })} /></Field>
            <Field label="Investimento"><input type="number" step="0.01" className="app-input w-full" value={plan.investimento ? String(plan.investimento) : ''} onChange={(e) => setPlan({ ...plan, investimento: e.target.value })} /></Field>
            <Field label="Objetivo"><textarea className="app-input min-h-28 w-full resize-y" value={plan.objetivo || ''} onChange={(e) => setPlan({ ...plan, objetivo: e.target.value })} /></Field>
            <Field label="Resultado esperado"><textarea className="app-input min-h-28 w-full resize-y" value={plan.resultadoEsperado || ''} onChange={(e) => setPlan({ ...plan, resultadoEsperado: e.target.value })} /></Field>
          </div>
        ) : null}

        {tab === 'acoes' ? (
          <div className="space-y-4">
            <div className="flex justify-end"><button type="button" onClick={openNewAction} className="app-button-primary">Nova ação</button></div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                  <tr><th className="px-3 py-2">Status</th><th className="px-3 py-2">Nº/ordem</th><th className="px-3 py-2">O quê</th><th className="px-3 py-2">Responsável</th><th className="px-3 py-2">Centro responsável</th><th className="px-3 py-2">Centro impactado</th><th className="px-3 py-2">Prazo</th><th className="px-3 py-2">RAB/prioridade</th><th className="px-3 py-2">Evidências</th><th className="px-3 py-2">Ações</th></tr>
                </thead>
                <tbody>
                  {actions.map((action, index) => (
                    <tr key={action.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{actionStatusLabel[action.status]}</td>
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2">{action.descricao}</td>
                      <td className="px-3 py-2">{action.responsavelNome || '-'}</td>
                      <td className="px-3 py-2">{action.centroResponsavel?.description || '-'}</td>
                      <td className="px-3 py-2">{action.centroImpactado?.description || '-'}</td>
                      <td className="px-3 py-2">{formatDate(action.prazo)}</td>
                      <td className="px-3 py-2">{priorityScore(action)}</td>
                      <td className="px-3 py-2">{action.evidencias ? 'Sim' : 'Não'}</td>
                      <td className="px-3 py-2"><div className="flex gap-2"><button type="button" onClick={() => openEditAction(action)} className="rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white">Exibir/Editar</button><button type="button" onClick={() => deleteAction(action)} className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white">Excluir</button></div></td>
                    </tr>
                  ))}
                  {actions.length === 0 ? <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500">Nenhuma ação vinculada a este plano.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === 'evidencias' ? <EvidenceList actions={actions} /> : null}
        {tab === 'historico' ? <p className="text-sm text-slate-600">Criado em {formatDate(plan.createdAt)}. Última atualização em {formatDate(plan.updatedAt)}.</p> : null}
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {actionModalOpen ? <ActionModal form={actionForm} setForm={setActionForm} onClose={() => setActionModalOpen(false)} onSubmit={saveAction} /> : null}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return <div className="app-card"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-900">{value}</p></div>
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded px-3 py-2 text-sm ${active ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700'}`}>{children}</button>
}

function EvidenceList({ actions }: { actions: PlanAction[] }) {
  const evidences = actions.filter((action) => action.evidencias)
  if (evidences.length === 0) return <p className="text-sm text-slate-600">Nenhuma evidência registrada nas ações deste plano.</p>
  return <div className="space-y-3">{evidences.map((action) => <div key={action.id} className="rounded border border-slate-200 p-3"><p className="font-medium">{action.descricao}</p><pre className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{action.evidencias}</pre></div>)}</div>
}

function ActionModal({ form, setForm, onClose, onSubmit }: { form: ActionForm; setForm: (form: ActionForm) => void; onClose: () => void; onSubmit: (e: FormEvent) => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-4xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-lg font-semibold">{form.id ? 'Exibir/Editar ação' : 'Nova ação'}</h2><button type="button" onClick={onClose} className="rounded border px-2 py-1 text-sm">Fechar</button></div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="O quê? *"><textarea required className="app-input min-h-24 w-full resize-y" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Field>
          <Field label="Responsável"><input className="app-input w-full" value={form.responsavelNome} onChange={(e) => setForm({ ...form, responsavelNome: e.target.value })} /></Field>
          <Field label="Por quê?"><textarea className="app-input min-h-20 w-full resize-y" value={form.motivoBeneficio} onChange={(e) => setForm({ ...form, motivoBeneficio: e.target.value })} /></Field>
          <Field label="Como?"><textarea className="app-input min-h-20 w-full resize-y" value={form.atividadeComo} onChange={(e) => setForm({ ...form, atividadeComo: e.target.value })} /></Field>
          <Field label="Onde/origem"><input className="app-input w-full" value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} /></Field>
          <Field label="Prazo"><input type="date" className="app-input w-full" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></Field>
          <Field label="Status"><select className="app-select w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ActionStatus })}>{Object.entries(actionStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <div className="grid grid-cols-3 gap-2"><Field label="Rapidez"><input type="number" min="1" max="5" className="app-input w-full" value={form.rapidez} onChange={(e) => setForm({ ...form, rapidez: e.target.value })} /></Field><Field label="Autonomia"><input type="number" min="1" max="5" className="app-input w-full" value={form.autonomia} onChange={(e) => setForm({ ...form, autonomia: e.target.value })} /></Field><Field label="Benefício"><input type="number" min="1" max="5" className="app-input w-full" value={form.beneficio} onChange={(e) => setForm({ ...form, beneficio: e.target.value })} /></Field></div>
          <div className="md:col-span-2"><Field label="Evidências"><textarea className="app-input min-h-24 w-full resize-y" value={form.evidencias} onChange={(e) => setForm({ ...form, evidencias: e.target.value })} /></Field></div>
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-4"><button type="button" onClick={onClose} className="app-button-secondary">Cancelar</button><button type="submit" className="app-button-primary">Salvar ação</button></div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1.5 text-sm font-medium"><span className="app-label">{label}</span><div>{children}</div></label>
}
