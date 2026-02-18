'use client'

import Link from 'next/link'
import { NonConformityActionStatus, NonConformityActionType } from '@prisma/client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { actionStatusLabel } from '@/lib/sst/serializers'

type CostCenter = { id: string; code: string; description: string }

type DetailPayload = {
  action: {
    id: string
    descricao: string
    motivoBeneficio?: string | null
    atividadeComo?: string | null
    centroImpactadoId?: string | null
    centroImpactadoDescricao?: string | null
    centroResponsavelId?: string | null
    dataInicioPrevista?: string | null
    dataFimPrevista?: string | null
    custo?: string | number | null
    dataConclusao?: string | null
    tipo: NonConformityActionType
    origem?: string | null
    referencia?: string | null
    rapidez?: number | null
    autonomia?: number | null
    beneficio?: number | null
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
const ACTION_TYPE_OPTIONS = Object.values(NonConformityActionType)

const RAB_LABELS = {
  rapidez: {
    1: '1 - ATÉ 01 SEMANA',
    2: '2 - ATÉ 15 DIAS',
    3: '3 - ATÉ 30 DIAS',
    4: '4 - ATÉ 60 DIAS',
    5: '5 - ACIMA DE 60 DIAS',
  },
  autonomia: {
    1: '1 - OPERACIONAL',
    2: '2 - COORDENAÇÃO',
    3: '3 - GERÊNCIA EXECUTIVA',
    4: '4 - DIRETORIA',
    5: '5 - PRESIDÊNCIA',
  },
  beneficio: {
    1: '1 - INDIVIDUAL',
    2: '2 - SOMENTE O SETOR',
    3: '3 - MAIS DE UM SETOR',
    4: '4 - TODA A UNIDADE',
    5: '5 - ORGANIZAÇÃO',
  },
} as const

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR')
}
function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : ''
}

function toCostCenterLabel(center?: CostCenter | null) {
  if (!center) return ''
  return `${center.code} - ${center.description}`
}

function RadarPreview({ rapidez, autonomia, beneficio }: { rapidez: number; autonomia: number; beneficio: number }) {
  const base = 100
  const scale = 14
  const angles = [-90, 30, 150]
  const values = [rapidez, autonomia, beneficio]

  const points = values
    .map((value, index) => {
      const radius = value * scale
      const rad = (angles[index] * Math.PI) / 180
      const x = base + Math.cos(rad) * radius
      const y = base + Math.sin(rad) * radius
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width="220" height="220" viewBox="0 0 220 220" className="mx-auto">
      {[1, 2, 3, 4, 5].map((step) => (
        <circle key={step} cx="100" cy="100" r={step * scale} fill="none" stroke="#e2e8f0" strokeWidth="1" />
      ))}
      <polygon points={points} fill="rgba(59,130,246,0.35)" stroke="#2563eb" strokeWidth="2" />
      <text x="98" y="16" className="fill-slate-500 text-[10px]">Rapidez</text>
      <text x="168" y="144" className="fill-slate-500 text-[10px]">Autonomia</text>
      <text x="12" y="144" className="fill-slate-500 text-[10px]">Benefício</text>
    </svg>
  )
}

export default function AcaoNaoConformidadeDetailClient({ id, actionId }: { id: string; actionId: string }) {
   const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('dados')
  const [item, setItem] = useState<DetailPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [observacao, setObservacao] = useState('')

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
  const [origem, setOrigem] = useState('NÃO CONFORMIDADE')
  const [referencia, setReferencia] = useState('')
  const [status, setStatus] = useState<NonConformityActionStatus>(NonConformityActionStatus.PENDENTE)
  const [evidencias, setEvidencias] = useState('')
  const [rapidez, setRapidez] = useState(1)
  const [autonomia, setAutonomia] = useState(1)
  const [beneficio, setBeneficio] = useState(1)

  async function load() {
    try {
      setLoading(true)
      const [res, centersRes] = await Promise.all([
        fetch(`/api/sst/nao-conformidades/${id}/plano-de-acao/${actionId}`, { cache: 'no-store' }),
        fetch('/api/cost-centers/select', { cache: 'no-store' }),
      ])

       const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar ação.')

      if (centersRes.ok) {
        const centersData = await centersRes.json().catch(() => [])
        setCostCenters(Array.isArray(centersData) ? centersData : [])
      }
     const payload: DetailPayload = data.item
      setItem(payload)

      const action = payload.action
      setDescricao(action.descricao || '')
      setMotivoBeneficio(action.motivoBeneficio || '')
      setAtividadeComo(action.atividadeComo || '')
      setCentroImpactadoId(action.centroImpactadoId || '')
      setCentroImpactadoDescricao(action.centroImpactadoDescricao || '')
      setCentroResponsavelId(action.centroResponsavelId || '')
      setResponsavelNome(action.responsavelNome || '')
      setDataInicioPrevista(toDateInput(action.dataInicioPrevista))
      setDataFimPrevista(toDateInput(action.dataFimPrevista))
      setCusto(action.custo !== null && action.custo !== undefined ? String(action.custo) : '')
      setDataConclusao(toDateInput(action.dataConclusao))
      setTipo(action.tipo || NonConformityActionType.ACAO_CORRETIVA)
      setOrigem(action.origem || 'NÃO CONFORMIDADE')
      setReferencia(action.referencia || payload.nonConformity.numeroRnc || '')
      setStatus(action.status)
      setEvidencias(action.evidencias || '')
      setRapidez(action.rapidez || 1)
      setAutonomia(action.autonomia || 1)
      setBeneficio(action.beneficio || 1)
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

  async function patchAction(partial: Record<string, unknown> = {}) {
    if (readOnly) return

    setSaving(true)
    try {
      const res = await fetch(`/api/sst/nao-conformidades/${id}/plano-de-acao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: actionId,
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
          status,
          evidencias,
          rapidez,
          autonomia,
          beneficio,
          prazo: dataFimPrevista || null,
          ...partial,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao atualizar ação.')
      setObservacao('')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar ação.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await patchAction()
  }

  async function handleCancelAction() {
    await patchAction({ status: NonConformityActionStatus.CANCELADA })
  }

  async function handleConcludeAction() {
     await patchAction({ status: NonConformityActionStatus.CONCLUIDA, dataConclusao: new Date().toISOString().slice(0, 10) })
  }

  async function handleReopenAction() {
    await patchAction({ status: NonConformityActionStatus.PENDENTE })
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

  async function adicionarObservacao() {
    if (!observacao.trim()) return
    await patchAction({ observacao: observacao.trim() })
  }

  if (loading && !item) return <p className="text-sm text-slate-600">Carregando ação...</p>
  if (error && !item) return <p className="text-sm text-rose-700">{error}</p>
  if (!item) return null

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm uppercase text-slate-500">Ação da Não Conformidade</p>
          <h1 className="text-2xl font-bold text-slate-900">Ação #{item.action.id.slice(-6)}</h1>
          <p className="text-sm text-slate-600">Nº RNC: {item.nonConformity.numeroRnc}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={handleCancelAction} disabled={readOnly || saving} className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleReopenAction} disabled={readOnly || saving} className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 disabled:opacity-50">Reabrir</button>
          <button type="button" onClick={handleConcludeAction} disabled={readOnly || saving} className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50">Concluir Ação</button>
         <button type="submit" form="form-acao-nc" disabled={readOnly || saving} className="rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar/Atualizar'}</button>
          <button type="button" onClick={() => router.push(`/dashboard/sst/nao-conformidades/${id}?section=planoDeAcao`)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Sair</button>
        </div>
      </header>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex gap-2">
          <button type="button" onClick={() => setActiveTab('dados')} className={`rounded-md px-3 py-2 text-sm font-medium ${activeTab === 'dados' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Ação - Dados Básicos</button>
          <button type="button" onClick={() => setActiveTab('evidencias')} className={`rounded-md px-3 py-2 text-sm font-medium ${activeTab === 'evidencias' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Evidências</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {activeTab === 'dados' ? (
            <form id="form-acao-nc" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">O quê?
                    <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={readOnly || saving} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">Por quê?
                    <textarea value={motivoBeneficio} onChange={(e) => setMotivoBeneficio(e.target.value)} disabled={readOnly || saving} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">Como?
                    <textarea value={atividadeComo} onChange={(e) => setAtividadeComo(e.target.value)} disabled={readOnly || saving} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">Onde? (centro impactado)
                    <select value={centroImpactadoId} onChange={(e) => setCentroImpactadoId(e.target.value)} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal">
                      <option value="">Selecione</option>
                      {costCenters.map((cc) => (<option key={cc.id} value={cc.id}>{toCostCenterLabel(cc)}</option>))}
                    </select>
                  </label>
                  {!centroImpactadoId ? (
                    <label className="block text-sm font-medium text-slate-700">Descrição do centro impactado
                      <input value={centroImpactadoDescricao} onChange={(e) => setCentroImpactadoDescricao(e.target.value)} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                    </label>
                  ) : null}
                  <label className="block text-sm font-medium text-slate-700">Centro Responsável
                    <select value={centroResponsavelId} onChange={(e) => setCentroResponsavelId(e.target.value)} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal">
                      <option value="">Selecione</option>
                      {costCenters.map((cc) => (<option key={cc.id} value={cc.id}>{toCostCenterLabel(cc)}</option>))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">Quem?
                    <input value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                </div>

              <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">Início previsto
                      <input type="date" value={dataInicioPrevista} onChange={(e) => setDataInicioPrevista(e.target.value)} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">Fim previsto
                      <input type="date" value={dataFimPrevista} onChange={(e) => setDataFimPrevista(e.target.value)} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">Quanto? (custo)
                      <input value={custo} onChange={(e) => setCusto(e.target.value)} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">Data Conclusão
                      <input type="date" value={dataConclusao} onChange={(e) => setDataConclusao(e.target.value)} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                    </label>
                  </div>
                  <label className="block text-sm font-medium text-slate-700">Tipo
                    <select value={tipo} onChange={(e) => setTipo(e.target.value as NonConformityActionType)} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal">
                      {ACTION_TYPE_OPTIONS.map((option) => (<option key={option} value={option}>{option}</option>))}
                    </select>
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">Origem
                      <input value={origem} onChange={(e) => setOrigem(e.target.value)} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">Referência
                      <input value={referencia} onChange={(e) => setReferencia(e.target.value)} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                    </label>
                  </div>
                  <label className="block text-sm font-medium text-slate-700">Status
                    <select value={status} onChange={(e) => setStatus(e.target.value as NonConformityActionStatus)} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal">
                      {ACTION_STATUS_OPTIONS.map((option) => (<option key={option} value={option}>{actionStatusLabel[option]}</option>))}
                    </select>
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">Histórico</p>
                      <button type="button" onClick={adicionarObservacao} disabled={readOnly || saving || !observacao.trim()} className="rounded bg-sky-500 px-3 py-1 text-sm font-medium text-white disabled:opacity-50">Adicionar Observações</button>
                    </div>
                    <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={readOnly || saving} rows={3} placeholder="Digite uma observação" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                    <textarea value={evidencias} onChange={(e) => setEvidencias(e.target.value)} disabled={readOnly || saving} rows={7} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </div>
                </div>
              </div>

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
                <label className="block text-sm font-medium text-slate-700">Evidências (texto)
                <textarea value={evidencias} onChange={(e) => setEvidencias(e.target.value)} disabled={readOnly || saving} rows={8} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
              </label>
              <label className="block text-sm font-medium text-slate-700">Upload de anexos
                <input type="file" multiple disabled={readOnly || uploading} onChange={(e) => uploadFiles(e.target.files)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <p className="text-xs text-slate-500">{uploading ? 'Enviando evidências...' : 'Os anexos enviados ficam vinculados à não conformidade.'}</p>
              <button type="button" onClick={() => patchAction({ evidencias })} disabled={readOnly || saving} className="rounded bg-orange-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar evidências</button>
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm font-semibold text-slate-800">RAB - MÉDIA</p>
            <RadarPreview rapidez={rapidez} autonomia={autonomia} beneficio={beneficio} />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Rapidez
                <select value={rapidez} onChange={(e) => setRapidez(Number(e.target.value))} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal">
                  {[1, 2, 3, 4, 5].map((v) => (<option key={v} value={v}>{RAB_LABELS.rapidez[v as keyof typeof RAB_LABELS.rapidez]}</option>))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">Autonomia
                <select value={autonomia} onChange={(e) => setAutonomia(Number(e.target.value))} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal">
                  {[1, 2, 3, 4, 5].map((v) => (<option key={v} value={v}>{RAB_LABELS.autonomia[v as keyof typeof RAB_LABELS.autonomia]}</option>))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">Benefício
                <select value={beneficio} onChange={(e) => setBeneficio(Number(e.target.value))} disabled={readOnly || saving} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal">
                  {[1, 2, 3, 4, 5].map((v) => (<option key={v} value={v}>{RAB_LABELS.beneficio[v as keyof typeof RAB_LABELS.beneficio]}</option>))}
                </select>
              </label>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <p><strong>Status ação:</strong> {actionStatusLabel[item.action.status]}</p>
             <p><strong>Criado em:</strong> {formatDateTime(item.action.createdAt)}</p>
            <p><strong>Última atualização:</strong> {formatDateTime(item.action.updatedAt)}</p>
            <p className="mt-2"><Link href={`/dashboard/sst/nao-conformidades/${id}?section=planoDeAcao`} className="text-orange-600 hover:underline">Voltar para ações da NC</Link></p>
          </div>
        </aside>
      </div>
    </div>
  )
}