'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

type NonConformityActionStatus =
  | 'PENDENTE'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDA'
  | 'CANCELADA'

type NonConformityActionType =
  | 'ACAO_CORRETIVA'
  | 'ACAO_PREVENTIVA'
  | 'CORRECAO'

type CostCenter = {
  id: string
  code: string
  description: string
}

type Gestor = {
  id: string
  userId: string
  user: {
    id: string
    fullName: string | null
    email: string
  }
}

type ActionItem = {
  id: string
  descricao: string
  status: NonConformityActionStatus
  createdAt: string
  referencia?: string | null
  origem?: string | null
  prazo?: string | null
  responsavelNome?: string | null
  centroImpactado?: { description: string } | null
  atividadeComo?: string | null
  dataInicioPrevista?: string | null
  dataFimPrevista?: string | null
  custo?: number | null
  tipo?: NonConformityActionType | null
  dataConclusao?: string | null
  centroResponsavelId?: string | null
  responsavelId?: string | null
  evidencias?: string | null
  motivoBeneficio?: string | null
}

type WhyRow = {
  pergunta: string
  resposta: string
}

type PlanoResponse = {
  item?: ActionItem
  error?: string
}

type PlanoListResponse = {
  items?: ActionItem[]
  error?: string
}

type GestoresResponse = {
  members?: Gestor[]
}

const STATUS_OPTIONS: NonConformityActionStatus[] = [
  'PENDENTE',
  'EM_ANDAMENTO',
  'CONCLUIDA',
  'CANCELADA',
]

const TYPE_OPTIONS: NonConformityActionType[] = [
  'ACAO_CORRETIVA',
  'ACAO_PREVENTIVA',
  'CORRECAO',
]

const STATUS_LABELS: Record<NonConformityActionStatus, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em execução',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}

const TYPE_LABELS: Record<NonConformityActionType, string> = {
  ACAO_CORRETIVA: 'Ação corretiva',
  ACAO_PREVENTIVA: 'Ação preventiva',
  CORRECAO: 'Correção',
}

function toDateInput(value?: string | null) {
  return value ? String(value).slice(0, 10) : ''
}

function toCostCenterLabel(center?: CostCenter | null) {
  if (!center) return ''
  return `${center.code} - ${center.description}`
}

function parseWhyRows(raw?: string | null): WhyRow[] {
  if (!raw) return [{ pergunta: '', resposta: '' }]

  try {
    const parsed = JSON.parse(raw)

    if (Array.isArray(parsed)) {
      const rows = parsed
        .map((row) => ({
          pergunta: String(row?.pergunta || ''),
          resposta: String(row?.resposta || ''),
        }))
        .filter((row) => row.pergunta || row.resposta)

      return rows.length ? rows : [{ pergunta: '', resposta: '' }]
    }
  } catch {
    // ignora JSON inválido e cai no fallback
  }

  return [{ pergunta: '', resposta: '' }]
}

function getOnde(origem?: string | null) {
  if (!origem) return ''
  return origem.startsWith('LOCAL:') ? origem.replace('LOCAL:', '') : origem
}

function buildOrigem(onde?: string) {
  const value = (onde || '').trim()
  return value ? `LOCAL:${value}` : null
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

export default function PlanoAvulsoDetailClient({
  actionId,
}: {
  actionId: string
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingEvidence, setUploadingEvidence] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'plano' | 'causa'>('plano')

  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [gestores, setGestores] = useState<Gestor[]>([])
  const [allActions, setAllActions] = useState<ActionItem[]>([])

  const [objetivo, setObjetivo] = useState('')
  const [resultadoEsperado, setResultadoEsperado] = useState('')
  const [dataInicioPrevista, setDataInicioPrevista] = useState('')
  const [dataFimPrevista, setDataFimPrevista] = useState('')
  const [status, setStatus] = useState<NonConformityActionStatus>('PENDENTE')
  const [investimento, setInvestimento] = useState('')
  const [tipo, setTipo] = useState<NonConformityActionType>('ACAO_CORRETIVA')
  const [dataConclusao, setDataConclusao] = useState('')
  const [centroResponsavelId, setCentroResponsavelId] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [responsavelNome, setResponsavelNome] = useState('')
  const [evidencias, setEvidencias] = useState('')

  const [whyRows, setWhyRows] = useState<WhyRow[]>([
    { pergunta: '', resposta: '' },
  ])
  const [causaRaiz, setCausaRaiz] = useState('')

  const [editingAction, setEditingAction] = useState<ActionItem | null>(null)
  const [actionForm, setActionForm] = useState({
    descricao: '',
    prazo: '',
    responsavelNome: '',
    status: 'PENDENTE' as NonConformityActionStatus,
    onde: '',
  })

  const rootAction = useMemo(
    () => allActions.find((a) => a.id === actionId) ?? allActions[0] ?? null,
    [allActions, actionId]
  )

  const planReference = rootAction?.referencia || rootAction?.id || actionId

  const childActions = useMemo(() => {
    if (!rootAction) return []
    return allActions.filter((a) => a.id !== rootAction.id)
  }, [allActions, rootAction])

  const resetActionForm = useCallback(() => {
    setEditingAction(null)
    setActionForm({
      descricao: '',
      prazo: '',
      responsavelNome: '',
      status: 'PENDENTE',
      onde: '',
    })
  }, [])

  const startEditingAction = useCallback((action: ActionItem) => {
    setEditingAction(action)
    setActionForm({
      descricao: action.descricao || '',
      prazo: toDateInput(action.prazo),
      responsavelNome: action.responsavelNome || '',
      status: action.status,
      onde: getOnde(action.origem),
    })
  }, [])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [res, centersRes, gestoresRes] = await Promise.all([
        fetch(`/api/sst/plano-de-acao/${actionId}`, { cache: 'no-store' }),
        fetch('/api/cost-centers/select', { cache: 'no-store' }),
        fetch('/api/configuracoes/gestores', { cache: 'no-store' }),
      ])

      const data = await parseJsonSafe<PlanoResponse>(res)
      if (!res.ok || !data?.item) {
        throw new Error(data?.error || 'Erro ao carregar plano.')
      }

      if (centersRes.ok) {
        const centersData = await parseJsonSafe<CostCenter[]>(centersRes)
        setCostCenters(Array.isArray(centersData) ? centersData : [])
      } else {
        setCostCenters([])
      }

      if (gestoresRes.ok) {
        const gestoresData = await parseJsonSafe<GestoresResponse>(gestoresRes)
        setGestores(Array.isArray(gestoresData?.members) ? gestoresData!.members! : [])
      } else {
        setGestores([])
      }

      const item = data.item

      setObjetivo(item.descricao || '')
      setResultadoEsperado(item.atividadeComo || '')
      setDataInicioPrevista(toDateInput(item.dataInicioPrevista))
      setDataFimPrevista(toDateInput(item.dataFimPrevista || item.prazo))
      setStatus(item.status || 'PENDENTE')
      setInvestimento(item.custo != null ? String(item.custo) : '')
      setTipo(item.tipo || 'ACAO_CORRETIVA')
      setDataConclusao(toDateInput(item.dataConclusao))
      setCentroResponsavelId(item.centroResponsavelId || '')
      setResponsavelId(item.responsavelId || '')
      setResponsavelNome(item.responsavelNome || '')
      setEvidencias(item.evidencias || '')
      setCausaRaiz(item.origem || '')
      setWhyRows(parseWhyRows(item.motivoBeneficio))

      const reference = item.referencia || item.id
      const actionsRes = await fetch(
        `/api/sst/plano-de-acao?referencia=${encodeURIComponent(reference)}`,
        { cache: 'no-store' }
      )
      const actionsData = await parseJsonSafe<PlanoListResponse>(actionsRes)

      if (actionsRes.ok && Array.isArray(actionsData?.items)) {
        setAllActions(actionsData!.items!)
      } else {
        setAllActions([item])
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Erro ao carregar plano.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [actionId])

  useEffect(() => {
    void load()
  }, [load])

  async function uploadEvidence(file: File) {
    try {
      setUploadingEvidence(true)
      setError(null)

      const body = new FormData()
      body.set('file', file)

      const res = await fetch('/api/uploads?scope=plano-acao-avulso', {
        method: 'POST',
        body,
      })

      const data = await parseJsonSafe<{ url?: string; error?: string }>(res)

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Falha no upload do arquivo.')
      }

      setEvidencias((prev) => `${prev ? `${prev}\n` : ''}${data.url}`)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha no upload do arquivo.'
      setError(message)
    } finally {
      setUploadingEvidence(false)
    }
  }

  async function savePlan() {
    try {
      setSaving(true)
      setError(null)

      const selectedGestor = gestores.find((g) => g.userId === responsavelId)
      const responsavelFinal =
        selectedGestor?.user.fullName ||
        selectedGestor?.user.email ||
        responsavelNome ||
        null

      const res = await fetch(`/api/sst/plano-de-acao/${rootAction?.id || actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao: objetivo,
          atividadeComo: resultadoEsperado,
          dataInicioPrevista: dataInicioPrevista || null,
          dataFimPrevista: dataFimPrevista || null,
          status,
          custo: investimento ? Number(investimento) : null,
          tipo,
          dataConclusao: dataConclusao || null,
          centroResponsavelId: centroResponsavelId || null,
          responsavelId: responsavelId || null,
          responsavelNome: responsavelFinal,
          evidencias,
          referencia: planReference,
          motivoBeneficio: JSON.stringify(whyRows),
          origem: causaRaiz || null,
          prazo: dataFimPrevista || null,
        }),
      })

      const data = await parseJsonSafe<{ error?: string }>(res)

      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao salvar plano.')
      }

      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao salvar plano.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function saveActionRow() {
    try {
      setSaving(true)
      setError(null)

      const payload = {
        descricao: actionForm.descricao.trim(),
        prazo: actionForm.prazo || null,
        status: actionForm.status,
        responsavelNome: actionForm.responsavelNome.trim() || null,
        referencia: planReference,
        origem: buildOrigem(actionForm.onde),
      }

      if (!payload.descricao) {
        throw new Error('Informe a descrição da ação.')
      }

      const res = editingAction
        ? await fetch(`/api/sst/plano-de-acao/${editingAction.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/sst/plano-de-acao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      const data = await parseJsonSafe<{ error?: string }>(res)

      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao salvar ação.')
      }

      resetActionForm()
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao salvar ação.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteActionRow(action: ActionItem) {
    const confirmed = window.confirm('Deseja excluir esta ação?')
    if (!confirmed) return

    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`/api/sst/plano-de-acao/${action.id}`, {
        method: 'DELETE',
      })

      const data = await parseJsonSafe<{ error?: string }>(res)

      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao excluir ação.')
      }

      resetActionForm()
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao excluir ação.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  function updateWhyRow(index: number, field: keyof WhyRow, value: string) {
    setWhyRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  function addWhyRow() {
    setWhyRows((prev) => [...prev, { pergunta: '', resposta: '' }])
  }

  function removeWhyRow(index: number) {
    setWhyRows((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : [{ pergunta: '', resposta: '' }]
    })
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Carregando plano...</p>
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-100 p-1">
      <header className="flex flex-wrap items-center gap-2 bg-slate-300 p-2">
        <h1 className="text-3xl font-semibold text-slate-800">Plano de Ação</h1>

        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-sky-500 px-2 py-1 text-sm text-white"
          >
            Imprimir
          </button>

          <button
            type="button"
            onClick={savePlan}
            disabled={saving}
            className="rounded bg-blue-600 px-2 py-1 text-sm text-white disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar / Atualizar'}
          </button>

          <Link
            href="/dashboard/sgi/qualidade/planos-de-acao"
            className="rounded bg-white px-2 py-1 text-sm"
          >
            Sair
          </Link>
        </div>
      </header>

      <div className="flex gap-1 border-b border-slate-300 px-2">
        <button
          type="button"
          onClick={() => setActiveTab('plano')}
          className={`rounded-t border px-3 py-1 text-sm ${
            activeTab === 'plano'
              ? 'bg-white text-blue-700'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          Plano de Ação
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('causa')}
          className={`rounded-t border px-3 py-1 text-sm ${
            activeTab === 'causa'
              ? 'bg-white text-blue-700'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          Estudo de Causa
        </button>
      </div>

      {activeTab === 'plano' && (
        <section className="space-y-4 bg-slate-100 p-3">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-sm">
                Objetivo
                <textarea
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded border px-2 py-1"
                />
              </label>

              <label className="block text-sm">
                Resultado Esperado
                <textarea
                  value={resultadoEsperado}
                  onChange={(e) => setResultadoEsperado(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded border px-2 py-1"
                />
              </label>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-sm">
                Prev. Início
                <input
                  type="date"
                  value={dataInicioPrevista}
                  onChange={(e) => setDataInicioPrevista(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-1"
                />
              </label>

              <label className="text-sm">
                Prev. Fim
                <input
                  type="date"
                  value={dataFimPrevista}
                  onChange={(e) => setDataFimPrevista(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-1"
                />
              </label>

              <label className="text-sm">
                Status
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as NonConformityActionStatus)
                  }
                  className="mt-1 w-full rounded border px-2 py-1"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {STATUS_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                Investimento
                <input
                  type="number"
                  step="0.01"
                  value={investimento}
                  onChange={(e) => setInvestimento(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-1"
                />
              </label>

              <label className="text-sm">
                Tipo
                <select
                  value={tipo}
                  onChange={(e) =>
                    setTipo(e.target.value as NonConformityActionType)
                  }
                  className="mt-1 w-full rounded border px-2 py-1"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {TYPE_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                Data Conclusão
                <input
                  type="date"
                  value={dataConclusao}
                  onChange={(e) => setDataConclusao(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-1"
                />
              </label>

              <label className="text-sm md:col-span-2">
                Centro Responsável
                <select
                  value={centroResponsavelId}
                  onChange={(e) => setCentroResponsavelId(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-1"
                >
                  <option value="">Selecione uma opção</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {toCostCenterLabel(cc)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm md:col-span-2">
                Responsável
                <select
                  value={responsavelId}
                  onChange={(e) => setResponsavelId(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-1"
                >
                  <option value="">Selecione uma opção</option>
                  {gestores.map((g) => (
                    <option key={g.id} value={g.userId}>
                      {g.user.fullName || g.user.email}
                    </option>
                  ))}
                </select>
              </label>

              {!responsavelId && (
                <label className="text-sm md:col-span-2">
                  Nome do responsável
                  <input
                    value={responsavelNome}
                    onChange={(e) => setResponsavelNome(e.target.value)}
                    className="mt-1 w-full rounded border px-2 py-1"
                    placeholder="Informe o responsável manualmente"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="rounded border bg-white p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-2xl">Ações</p>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetActionForm}
                  className="rounded bg-slate-600 px-2 py-1 text-sm text-white"
                >
                  Nova ação
                </button>

                <button
                  type="button"
                  disabled={!editingAction || saving}
                  onClick={() =>
                    editingAction && deleteActionRow(editingAction)
                  }
                  className="rounded bg-red-500 px-2 py-1 text-sm text-white disabled:opacity-60"
                >
                  Excluir ação selecionada
                </button>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-slate-50 text-left">
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Nº Processo</th>
                  <th className="px-2 py-2">Data Criação</th>
                  <th className="px-2 py-2">O que</th>
                  <th className="px-2 py-2">Prioridade</th>
                  <th className="px-2 py-2">Onde</th>
                </tr>
              </thead>

              <tbody>
                {childActions.map((action) => (
                  <tr
                    key={action.id}
                    className={`cursor-pointer border-b ${
                      editingAction?.id === action.id ? 'bg-orange-100' : ''
                    }`}
                    onClick={() => startEditingAction(action)}
                  >
                    <td className="px-2 py-2">{STATUS_LABELS[action.status]}</td>
                    <td className="px-2 py-2">{action.referencia || '-'}</td>
                    <td className="px-2 py-2">
                      {new Date(action.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-2 py-2">{action.descricao}</td>
                    <td className="px-2 py-2">
                      {action.status === 'PENDENTE' ? 'Média' : 'Alta'}
                    </td>
                    <td className="px-2 py-2">{getOnde(action.origem) || '-'}</td>
                  </tr>
                ))}

                {childActions.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-3 text-center text-slate-500"
                    >
                      Nenhuma ação encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="mt-3 grid gap-2 rounded border bg-slate-50 p-2 md:grid-cols-5">
              <input
                value={actionForm.descricao}
                onChange={(e) =>
                  setActionForm((p) => ({ ...p, descricao: e.target.value }))
                }
                placeholder="O que"
                className="rounded border px-2 py-1"
              />

              <input
                type="date"
                value={actionForm.prazo}
                onChange={(e) =>
                  setActionForm((p) => ({ ...p, prazo: e.target.value }))
                }
                className="rounded border px-2 py-1"
              />

              <input
                value={actionForm.responsavelNome}
                onChange={(e) =>
                  setActionForm((p) => ({
                    ...p,
                    responsavelNome: e.target.value,
                  }))
                }
                placeholder="Responsável"
                className="rounded border px-2 py-1"
              />

              <select
                value={actionForm.status}
                onChange={(e) =>
                  setActionForm((p) => ({
                    ...p,
                    status: e.target.value as NonConformityActionStatus,
                  }))
                }
                className="rounded border px-2 py-1"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {STATUS_LABELS[option]}
                  </option>
                ))}
              </select>

              <input
                value={actionForm.onde}
                onChange={(e) =>
                  setActionForm((p) => ({ ...p, onde: e.target.value }))
                }
                placeholder="Onde"
                className="rounded border px-2 py-1"
              />
            </div>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={saveActionRow}
                disabled={saving}
                className="rounded bg-blue-700 px-3 py-1 text-sm text-white disabled:opacity-60"
              >
                {saving
                  ? 'Salvando...'
                  : editingAction
                  ? 'Salvar edição'
                  : 'Salvar ação'}
              </button>

              {editingAction && (
                <button
                  type="button"
                  onClick={resetActionForm}
                  className="rounded bg-slate-500 px-3 py-1 text-sm text-white"
                >
                  Cancelar edição
                </button>
              )}
            </div>

            <div className="mt-3 text-sm text-slate-700">
              ✅ Em execução &nbsp; ☑️ Pendente &nbsp; ⚠️ Atrasado &nbsp; ✖️
              Cancelado &nbsp; ✔️ Concluído
            </div>
          </div>

          <div className="rounded border bg-white p-3">
            <label className="block text-sm">
              Evidências (links/observações)
              <textarea
                value={evidencias}
                onChange={(e) => setEvidencias(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="file"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  await uploadEvidence(file)
                  e.currentTarget.value = ''
                }}
                className="text-sm"
              />

              {uploadingEvidence && (
                <span className="text-sm text-slate-600">
                  Enviando evidência...
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'causa' && (
        <section className="space-y-4 bg-slate-100 p-3">
          <div className="rounded border bg-white p-3">
            <label className="block text-sm">
              Causa raiz
              <textarea
                value={causaRaiz}
                onChange={(e) => setCausaRaiz(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
          </div>

          <div className="rounded border bg-white p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">5 Porquês</h2>

              <button
                type="button"
                onClick={addWhyRow}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
              >
                Adicionar linha
              </button>
            </div>

            <div className="space-y-3">
              {whyRows.map((row, index) => (
                <div
                  key={`${index}-${row.pergunta}-${row.resposta}`}
                  className="grid gap-2 rounded border p-3 md:grid-cols-[1fr_1fr_auto]"
                >
                  <input
                    value={row.pergunta}
                    onChange={(e) =>
                      updateWhyRow(index, 'pergunta', e.target.value)
                    }
                    placeholder={`Pergunta ${index + 1}`}
                    className="rounded border px-2 py-1"
                  />

                  <input
                    value={row.resposta}
                    onChange={(e) =>
                      updateWhyRow(index, 'resposta', e.target.value)
                    }
                    placeholder={`Resposta ${index + 1}`}
                    className="rounded border px-2 py-1"
                  />

                  <button
                    type="button"
                    onClick={() => removeWhyRow(index)}
                    className="rounded bg-red-500 px-3 py-1 text-sm text-white"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {error && (
        <p className="px-3 pb-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  )
}