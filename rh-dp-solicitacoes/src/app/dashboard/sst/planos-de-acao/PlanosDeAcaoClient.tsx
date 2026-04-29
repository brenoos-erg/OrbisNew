'use client'

import Link from 'next/link'
import { NonConformityActionStatus } from '@prisma/client'
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import { actionStatusLabel } from '@/lib/sst/serializers'
import SstModuleTabs from '@/components/sst/SstModuleTabs'

type ActionRow = {
  id: string
  descricao: string
  responsavelNome?: string | null
  prazo?: string | null
  dataConclusao?: string | null
  status: NonConformityActionStatus
  createdAt: string
  referencia?: string | null
  origem?: string | null
  rapidez?: number | null
  autonomia?: number | null
  beneficio?: number | null
  centroResponsavel?: { description: string } | null
  centroImpactado?: { description: string } | null
  origemPlano?: 'PLANO_AVULSO' | 'NAO_CONFORMIDADE'
}

type PriorityFilter = 'TODAS' | 'ALTA' | 'MEDIA' | 'BAIXA'

const ACTION_STATUS_FILTER_OPTIONS = ['TODOS', ...Object.values(NonConformityActionStatus)] as const

type FilterStatus = (typeof ACTION_STATUS_FILTER_OPTIONS)[number]

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR')
}

function toDateOnly(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
 if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getOnde(origem?: string | null) {
  if (!origem) return '-'
  return origem.startsWith('LOCAL:') ? origem.slice(6) : origem
}

function getPriority(item: ActionRow): PriorityFilter {
  const score = (item.rapidez || 0) + (item.autonomia || 0) + (item.beneficio || 0)
  if (score >= 11) return 'ALTA'
  if (score >= 7) return 'MEDIA'
  return 'BAIXA'
}

function isOverdue(action: ActionRow) {
  const prazo = toDateOnly(action.prazo)
  if (!prazo) return false
  if (action.status === NonConformityActionStatus.CONCLUIDA || action.status === NonConformityActionStatus.CANCELADA) return false
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return prazo < today
}

export default function PlanosDeAcaoClient() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ActionRow[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    descricao: '',
    responsavelNome: '',
    prazo: '',
    status: NonConformityActionStatus.PENDENTE as NonConformityActionStatus,
  })

  const [numeroProcessoDraft, setNumeroProcessoDraft] = useState('')
  const [centroResponsavelDraft, setCentroResponsavelDraft] = useState('')
  const [centroImpactadoDraft, setCentroImpactadoDraft] = useState('')
  const [responsavelDraft, setResponsavelDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState<FilterStatus>('TODOS')
  const [prioridadeDraft, setPrioridadeDraft] = useState<PriorityFilter>('TODAS')
  const [ondeDraft, setOndeDraft] = useState('')
  const [emAtrasoDraft, setEmAtrasoDraft] = useState(false)
  const [dataCriacaoInicioDraft, setDataCriacaoInicioDraft] = useState('')
  const [dataCriacaoFimDraft, setDataCriacaoFimDraft] = useState('')
  const [dataConclusaoInicioDraft, setDataConclusaoInicioDraft] = useState('')
  const [dataConclusaoFimDraft, setDataConclusaoFimDraft] = useState('')

  const [numeroProcesso, setNumeroProcesso] = useState('')
  const [centroResponsavel, setCentroResponsavel] = useState('')
  const [centroImpactado, setCentroImpactado] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [status, setStatus] = useState<FilterStatus>('TODOS')
  const [prioridade, setPrioridade] = useState<PriorityFilter>('TODAS')
  const [onde, setOnde] = useState('')
  const [emAtraso, setEmAtraso] = useState(false)
  const [dataCriacaoInicio, setDataCriacaoInicio] = useState('')
  const [dataCriacaoFim, setDataCriacaoFim] = useState('')
  const [dataConclusaoInicio, setDataConclusaoInicio] = useState('')
  const [dataConclusaoFim, setDataConclusaoFim] = useState('')

  const [page, setPage] = useState(1)
  const pageSize = 10

  async function load() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (numeroProcesso.trim()) params.set('numeroProcesso', numeroProcesso.trim())
      if (responsavel.trim()) params.set('responsavel', responsavel.trim())
      if (status !== 'TODOS') params.set('status', status)
      if (emAtraso) params.set('emAtraso', '1')

      const res = await fetch(`/api/sst/plano-de-acao?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar ações do plano.')

      setItems(Array.isArray(data.items) ? data.items : [])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar ações do plano.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [numeroProcesso, responsavel, status, emAtraso])

  const filteredItems = useMemo(() => {
    const criacaoIni = toDateOnly(dataCriacaoInicio)
    const criacaoFim = toDateOnly(dataCriacaoFim)
    const conclusaoIni = toDateOnly(dataConclusaoInicio)
    const conclusaoFim = toDateOnly(dataConclusaoFim)

    return items.filter((item) => {
      if (centroResponsavel.trim()) {
        const centro = item.centroResponsavel?.description || ''
        if (!centro.toLowerCase().includes(centroResponsavel.toLowerCase())) return false
      }

      if (centroImpactado.trim()) {
        const centro = item.centroImpactado?.description || ''
        if (!centro.toLowerCase().includes(centroImpactado.toLowerCase())) return false
      }

      if (onde.trim() && !getOnde(item.origem).toLowerCase().includes(onde.toLowerCase())) return false
      if (prioridade !== 'TODAS' && getPriority(item) !== prioridade) return false

      const createdAt = toDateOnly(item.createdAt)
      if (criacaoIni && createdAt && createdAt < criacaoIni) return false
      if (criacaoFim && createdAt && createdAt > criacaoFim) return false

      const dtConclusao = toDateOnly(item.dataConclusao)
      if (conclusaoIni && (!dtConclusao || dtConclusao < conclusaoIni)) return false
      if (conclusaoFim && (!dtConclusao || dtConclusao > conclusaoFim)) return false

      return true
    })
  }, [items, centroResponsavel, onde, prioridade, dataCriacaoInicio, dataCriacaoFim, dataConclusaoInicio, dataConclusaoFim])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, page])

  useEffect(() => {
    setPage(1)
  }, [filteredItems.length])

  async function handleDelete(item: ActionRow) {
    if (!window.confirm('Deseja excluir esta ação?')) return
    try {
      setDeletingId(item.id)
      const res = await fetch(`/api/sst/plano-de-acao/${item.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao excluir ação.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao excluir ação.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleCreateAction(e: FormEvent) {
    e.preventDefault()
    const descricao = createForm.descricao.trim()
    if (!descricao) {
      setError('Preencha a descrição da ação para registrar.')
      return
    }
    try {
      setCreating(true)
      const res = await fetch('/api/sst/plano-de-acao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao,
          responsavelNome: createForm.responsavelNome.trim() || null,
          prazo: createForm.prazo || null,
          status: createForm.status,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao registrar ação.')
      setCreateModalOpen(false)
      setCreateForm({
        descricao: '',
        responsavelNome: '',
        prazo: '',
        status: NonConformityActionStatus.PENDENTE,
      })
      setError(null)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao registrar ação.')
    } finally {
      setCreating(false)
    }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    setNumeroProcesso(numeroProcessoDraft)
    setCentroResponsavel(centroResponsavelDraft)
    setResponsavel(responsavelDraft)
    setCentroImpactado(centroImpactadoDraft)
    setStatus(statusDraft)
    setPrioridade(prioridadeDraft)
    setOnde(ondeDraft)
    setEmAtraso(emAtrasoDraft)
    setDataCriacaoInicio(dataCriacaoInicioDraft)
    setDataCriacaoFim(dataCriacaoFimDraft)
    setDataConclusaoInicio(dataConclusaoInicioDraft)
    setDataConclusaoFim(dataConclusaoFimDraft)
  }

  function limparFiltros() {
    setNumeroProcessoDraft('')
    setCentroResponsavelDraft('')
    setResponsavelDraft('')
    setCentroImpactadoDraft('')
    setStatusDraft('TODOS')
    setPrioridadeDraft('TODAS')
    setOndeDraft('')
    setEmAtrasoDraft(false)
    setDataCriacaoInicioDraft('')
    setDataCriacaoFimDraft('')
    setDataConclusaoInicioDraft('')
    setDataConclusaoFimDraft('')

    setNumeroProcesso('')
    setCentroResponsavel('')
    setResponsavel('')
    setCentroImpactado('')
    setStatus('TODOS')
    setPrioridade('TODAS')
    setOnde('')
    setEmAtraso(false)
    setDataCriacaoInicio('')
    setDataCriacaoFim('')
    setDataConclusaoInicio('')
    setDataConclusaoFim('')
  }

 return (
    <div className="space-y-5">
      <SstModuleTabs active="planos-de-acao" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase text-slate-500">SGI / Qualidade</p>
          <h1 className="text-3xl font-bold text-slate-900">Ações do plano de ação</h1>
          <p className="max-w-3xl text-slate-600">Listagem completa das ações com filtros, visualização, edição e exclusão.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          Registrar ação
        </button>      </div>

      <form onSubmit={handleSearch} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Nº Processo"><input value={numeroProcessoDraft} onChange={(e) => setNumeroProcessoDraft(e.target.value)} className="input" /></Field>
          <Field label="Centro responsável"><input value={centroResponsavelDraft} onChange={(e) => setCentroResponsavelDraft(e.target.value)} className="input" /></Field>
          <Field label="Responsável"><input value={responsavelDraft} onChange={(e) => setResponsavelDraft(e.target.value)} className="input" /></Field>
          <Field label="Centro impactado"><input value={centroImpactadoDraft} onChange={(e) => setCentroImpactadoDraft(e.target.value)} className="input" /></Field>
          <Field label="Prioridade"><select value={prioridadeDraft} onChange={(e) => setPrioridadeDraft(e.target.value as PriorityFilter)} className="input"><option value="TODAS">Todas</option><option value="ALTA">Alta</option><option value="MEDIA">Média</option><option value="BAIXA">Baixa</option></select></Field>
          <Field label="Status"><select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value as FilterStatus)} className="input">{ACTION_STATUS_FILTER_OPTIONS.map((option) => <option key={option} value={option}>{option === 'TODOS' ? 'Todos' : actionStatusLabel[option]}</option>)}</select></Field>
          <Field label="Onde"><input value={ondeDraft} onChange={(e) => setOndeDraft(e.target.value)} className="input" /></Field>
          <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={emAtrasoDraft} onChange={(e) => setEmAtrasoDraft(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />Em atraso</label>
          <div />
          <Field label="Data criação (início)"><input type="date" value={dataCriacaoInicioDraft} onChange={(e) => setDataCriacaoInicioDraft(e.target.value)} className="input" /></Field>
          <Field label="Data criação (fim)"><input type="date" value={dataCriacaoFimDraft} onChange={(e) => setDataCriacaoFimDraft(e.target.value)} className="input" /></Field>
          <Field label="Data conclusão (início)"><input type="date" value={dataConclusaoInicioDraft} onChange={(e) => setDataConclusaoInicioDraft(e.target.value)} className="input" /></Field>
          <Field label="Data conclusão (fim)"><input type="date" value={dataConclusaoFimDraft} onChange={(e) => setDataConclusaoFimDraft(e.target.value)} className="input" /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="rounded bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600">Pesquisar</button>
          <button type="button" onClick={limparFiltros} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Limpar filtros</button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Nº Processo</th>
              <th className="px-3 py-2">Data criação</th>
              <th className="px-3 py-2">Prioridade</th>
              <th className="px-3 py-2">O quê</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Onde</th>
              <th className="px-3 py-2">Centro responsável</th>
              <th className="px-3 py-2">Centro impactado</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map((item) => {
              const detailHref = `/dashboard/sgi/qualidade/planos-de-acao/${item.id}`
              const atrasada = isOverdue(item)

              return (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${atrasada ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>{atrasada ? 'Em atraso' : actionStatusLabel[item.status]}</span></td>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.referencia || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDate(item.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-700">{getPriority(item)}</td>
                  <td className="px-3 py-2 text-slate-700">{item.descricao}</td>
                  <td className="px-3 py-2 text-slate-700">{item.origemPlano === 'NAO_CONFORMIDADE' ? 'Não conformidade' : 'Plano avulso'}</td>
                  <td className="px-3 py-2 text-slate-700">{getOnde(item.origem)}</td>
                  <td className="px-3 py-2 text-slate-700">{item.centroResponsavel?.description || '-'}</td>
                  <td className="px-3 py-2 text-slate-700">{item.centroImpactado?.description || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Link href={detailHref} className="rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-700">Visualizar / Editar</Link>
                      <button type="button" onClick={() => handleDelete(item)} disabled={deletingId === item.id} className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">Excluir</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && pagedItems.length === 0 ? <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-500">Nenhuma ação encontrada para seus filtros ou permissões.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
        <p className="text-slate-600">Registros: {filteredItems.length}</p>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">Anterior</button>
          <span>Página {page} de {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">Próxima</button>
         </div>
        <p className="text-slate-600">Legenda: <span className="font-medium text-rose-700">Em atraso</span> · <span className="font-medium">Concluída</span> · <span className="font-medium">Cancelada</span></p>
      </footer>

      {loading ? <p className="text-sm text-slate-600">Carregando ações...</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {createModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-lg font-semibold text-slate-900">Registrar ação do plano</h2>
              <button type="button" onClick={() => setCreateModalOpen(false)} className="rounded border px-2 py-1 text-sm">Fechar</button>
            </div>
            <form onSubmit={handleCreateAction} className="space-y-4 p-4">
              <Field label="Descrição *">
                <textarea
                  value={createForm.descricao}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, descricao: e.target.value }))}
                  className="input min-h-24"
                  required
                />
              </Field>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Responsável">
                  <input
                    value={createForm.responsavelNome}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, responsavelNome: e.target.value }))}
                    className="input"
                  />
                </Field>
                <Field label="Prazo">
                  <input
                    type="date"
                    value={createForm.prazo}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, prazo: e.target.value }))}
                    className="input"
                  />
                </Field>
                <Field label="Status">
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value as NonConformityActionStatus }))}
                    className="input"
                  >
                    {Object.values(NonConformityActionStatus).map((option) => (
                      <option key={option} value={option}>{actionStatusLabel[option]}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={creating} className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
                  {creating ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      <span>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}