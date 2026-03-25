'use client'

import Link from 'next/link'
import { NonConformityActionStatus, NonConformityActionType } from '@prisma/client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { actionStatusLabel } from '@/lib/sst/serializers'

type CostCenter = { id: string; code: string; description: string }

const ACTION_TYPE_OPTIONS = Object.values(NonConformityActionType)
const RAB_OPTIONS = [1, 2, 3, 4, 5]

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

  const [descricao, setDescricao] = useState('')
  const [motivoBeneficio, setMotivoBeneficio] = useState('')
  const [atividadeComo, setAtividadeComo] = useState('')
  const [centroImpactadoId, setCentroImpactadoId] = useState('')
  const [centroImpactadoDescricao, setCentroImpactadoDescricao] = useState('')
  const [centroResponsavelId, setCentroResponsavelId] = useState('')
  const [responsavelNome, setResponsavelNome] = useState('')
  const [dataInicioPrevista, setDataInicioPrevista] = useState('')
  const [dataFimPrevista, setDataFimPrevista] = useState('')
  const [custo, setCusto] = useState('')
  const [dataConclusao, setDataConclusao] = useState('')
  const [tipo, setTipo] = useState<NonConformityActionType>(NonConformityActionType.ACAO_CORRETIVA)
  const [origem, setOrigem] = useState('PLANO AVULSO')
  const [referencia, setReferencia] = useState('')
  const [rapidez, setRapidez] = useState(1)
  const [autonomia, setAutonomia] = useState(1)
  const [beneficio, setBeneficio] = useState(1)
  const [prazo, setPrazo] = useState('')
  const [status, setStatus] = useState<NonConformityActionStatus>(NonConformityActionStatus.PENDENTE)
  const [evidencias, setEvidencias] = useState('')
  const [observacao, setObservacao] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [res, centersRes] = await Promise.all([
          fetch(`/api/sst/plano-de-acao/${actionId}`, { cache: 'no-store' }),
          fetch('/api/cost-centers/select', { cache: 'no-store' }),
        ])

        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar plano.')

        if (centersRes.ok) {
          const centersData = await centersRes.json().catch(() => [])
          setCostCenters(Array.isArray(centersData) ? centersData : [])
        }

        const item = data?.item
        if (!item) throw new Error('Plano não encontrado.')

        setDescricao(item.descricao || '')
        setMotivoBeneficio(item.motivoBeneficio || '')
        setAtividadeComo(item.atividadeComo || '')
        setCentroImpactadoId(item.centroImpactadoId || '')
        setCentroImpactadoDescricao(item.centroImpactadoDescricao || '')
        setCentroResponsavelId(item.centroResponsavelId || '')
        setResponsavelNome(item.responsavelNome || '')
        setDataInicioPrevista(toDateInput(item.dataInicioPrevista))
        setDataFimPrevista(toDateInput(item.dataFimPrevista))
        setCusto(item.custo !== null && item.custo !== undefined ? String(item.custo) : '')
        setDataConclusao(toDateInput(item.dataConclusao))
        setTipo(item.tipo || NonConformityActionType.ACAO_CORRETIVA)
        setOrigem(item.origem || 'PLANO AVULSO')
        setReferencia(item.referencia || '')
        setRapidez(item.rapidez || 1)
        setAutonomia(item.autonomia || 1)
        setBeneficio(item.beneficio || 1)
        setPrazo(item.prazo ? String(item.prazo).slice(0, 10) : '')
        setStatus(item.status || NonConformityActionStatus.PENDENTE)
        setEvidencias(item.evidencias || '')
        setError(null)
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar plano.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [actionId])

  const statusBadgeClass = useMemo(() => {
    if (status === NonConformityActionStatus.CONCLUIDA) return 'bg-emerald-100 text-emerald-700'
    if (status === NonConformityActionStatus.CANCELADA) return 'bg-rose-100 text-rose-700'
    if (status === NonConformityActionStatus.EM_ANDAMENTO) return 'bg-sky-100 text-sky-700'
    return 'bg-slate-100 text-slate-700'
  }, [status])

  async function save(partial: Record<string, unknown> = {}) {
    try {
      setSaving(true)
      const res = await fetch(`/api/sst/plano-de-acao/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao,
          motivoBeneficio,
          atividadeComo,
          centroImpactadoId: centroImpactadoId || null,
          centroImpactadoDescricao: centroImpactadoDescricao || null,
          centroResponsavelId: centroResponsavelId || null,
          responsavelNome,
          dataInicioPrevista: dataInicioPrevista || null,
          dataFimPrevista: dataFimPrevista || null,
          custo: custo || null,
          dataConclusao: dataConclusao || null,
          tipo,
          origem,
          referencia,
          rapidez,
          autonomia,
          beneficio,
          prazo: prazo || dataFimPrevista || null,
          status,
          evidencias,
          observacao: observacao.trim() || undefined,
          ...partial,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar plano.')
      setObservacao('')
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
      router.push('/dashboard/sgi/qualidade/planos-de-acao')
      return
    }
    const data = await res.json().catch(() => ({}))
    setError(data?.error || 'Erro ao excluir plano.')
  }

  if (loading) return <p className="text-sm text-slate-600">Carregando plano...</p>

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm uppercase text-slate-500">Plano de ação independente</p>
          <h1 className="text-2xl font-bold text-slate-900">Ação #{actionId.slice(-6)}</h1>
          <p className="text-sm text-slate-600">Origem: Plano Avulso</p>
        </div>
         <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => save({ status: NonConformityActionStatus.CANCELADA })} disabled={saving} className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={() => save({ status: NonConformityActionStatus.PENDENTE })} disabled={saving} className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 disabled:opacity-50">Reabrir</button>
          <button type="button" onClick={() => save({ status: NonConformityActionStatus.CONCLUIDA, dataConclusao: new Date().toISOString().slice(0, 10) })} disabled={saving} className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50">Concluir ação</button>
          <button onClick={() => save()} disabled={saving} className="rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar/Atualizar'}</button>
          <Link href="/dashboard/sgi/qualidade/planos-de-acao" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Voltar</Link>
        </div>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <p className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass}`}>{actionStatusLabel[status]}</p>

        <div className="grid gap-4 xl:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">O quê?
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Por quê?
            <textarea value={motivoBeneficio} onChange={(e) => setMotivoBeneficio(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Como?
            <textarea value={atividadeComo} onChange={(e) => setAtividadeComo(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Onde? (centro impactado)
            <select value={centroImpactadoId} onChange={(e) => setCentroImpactadoId(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {costCenters.map((cc) => (<option key={cc.id} value={cc.id}>{toCostCenterLabel(cc)}</option>))}
            </select>
          </label>
          {!centroImpactadoId ? (
            <label className="block text-sm font-medium text-slate-700">Descrição do centro impactado
              <input value={centroImpactadoDescricao} onChange={(e) => setCentroImpactadoDescricao(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
          ) : null}
          <label className="block text-sm font-medium text-slate-700">Centro responsável
            <select value={centroResponsavelId} onChange={(e) => setCentroResponsavelId(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {costCenters.map((cc) => (<option key={cc.id} value={cc.id}>{toCostCenterLabel(cc)}</option>))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">Quem?
            <input value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Início previsto
            <input type="date" value={dataInicioPrevista} onChange={(e) => setDataInicioPrevista(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Fim previsto
            <input type="date" value={dataFimPrevista} onChange={(e) => setDataFimPrevista(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Prazo
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Data conclusão
            <input type="date" value={dataConclusao} onChange={(e) => setDataConclusao(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Custo
            <input type="number" step="0.01" value={custo} onChange={(e) => setCusto(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value as NonConformityActionType)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {ACTION_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Origem
            <input value={origem} onChange={(e) => setOrigem(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Referência
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Status
            <select value={status} onChange={(e) => setStatus(e.target.value as NonConformityActionStatus)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {Object.values(NonConformityActionStatus).map((option) => <option key={option} value={option}>{actionStatusLabel[option]}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Rapidez
            <select value={rapidez} onChange={(e) => setRapidez(Number(e.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {RAB_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Autonomia
            <select value={autonomia} onChange={(e) => setAutonomia(Number(e.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {RAB_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Benefício
            <select value={beneficio} onChange={(e) => setBeneficio(Number(e.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {RAB_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium">Histórico/Observações/Evidências
          <textarea value={evidencias} onChange={(e) => setEvidencias(e.target.value)} rows={8} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm font-medium">Adicionar observação de acompanhamento
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Ex.: contato com responsável, avanço da execução..." />
        </label>

        <div className="flex gap-2">
          <button onClick={() => save()} disabled={saving} className="rounded bg-orange-500 px-3 py-2 text-sm font-semibold text-white">Salvar</button>
          <button onClick={remove} type="button" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Excluir</button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}