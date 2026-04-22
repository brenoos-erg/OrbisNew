'use client'

import { FormEvent, useMemo, useState } from 'react'

type StatusOption = { value: string; label: string }
type SelectOption = { id: string; name: string }
type ResponsibleOption = { id: string; fullName: string }
type CostCenterOption = { id: string; code: string | null; description: string }
type PositionOption = { id: string; name: string }
type CampoSchema = {
  name: string
  label?: string
  type?: string
  required?: boolean
  options?: string[]
  defaultValue?: string
  section?: string
  stage?: string
  placeholder?: string
  readOnly?: boolean
  disabled?: boolean
  source?: string
}
type FluxoResponse = {
  solicitacao: {
    id: string
    protocolo: string
    tipo: string
    solicitante: string
    status: string
    statusLabel: string
    titulo: string
    descricao: string | null
    dataAbertura: string | null
    dataPrevista: string | null
    dataFechamento: string | null
  }
  etapaAtual: {
    id: string
    nome: string
    tipo: 'DEPARTMENT' | 'APPROVERS'
    departamento: string | null
    responsavelAtual: string | null
    status: string
  }
  dadosChamado: {
    payload: Record<string, unknown>
    secoes: Array<{ secao: string; campos: Array<{ chave: string; valor: unknown }> }>
  }
  aprovacoes: Array<{ aprovador: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' }>
  historico: Array<{
    etapa: string
    tipo: 'DEPARTMENT' | 'APPROVERS'
    status: 'FINALIZADO' | 'EM ANDAMENTO' | 'PENDENTE'
    dataInicio: string | null
    dataFim: string | null
  }>
  movimentacoes: Array<{ id: string; status: string; mensagem: string | null; data: string | null }>
  permissions: {
    canEdit: boolean
    canChangeStatus: boolean
  }
  statusOptions: StatusOption[]
  statusAtual: string
  departamentos: SelectOption[]
  responsaveis: ResponsibleOption[]
  valoresEdicao: {
    titulo: string
    descricao: string | null
    campos: Record<string, unknown>
  }
  formSchema: CampoSchema[]
  dataSources: {
    costCenters: CostCenterOption[]
    users: ResponsibleOption[]
    experienceEvaluators?: ResponsibleOption[]
    departments: SelectOption[]
    positions: PositionOption[]
  }
  metadata: {
    solicitanteEmail: string | null
    solicitanteLogin: string | null
    departamentoAtualId: string | null
    responsavelAtualId: string | null
  }
}

type TabId = 'fluxo' | 'dados' | 'editar' | 'status'

const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'

function statusClass(status: string) {
  if (status.includes('FINALIZADO') || status.includes('APPROVED') || status.includes('CONCLUID')) return 'bg-green-100 text-green-700'
  if (status.includes('ANDAMENTO') || status.includes('APROV') || status.includes('EM ') || status.includes('ATENDIMENTO')) {
    return 'bg-blue-100 text-blue-700'
  }
  if (status.includes('PENDENTE') || status.includes('PENDING') || status.includes('AGUARDANDO')) return 'bg-amber-100 text-amber-700'
  if (status.includes('REJECTED') || status.includes('REPROV') || status.includes('CANCEL')) return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-700'
}

function fmtDate(value: string | null) {
  if (!value) return '—'
  const dt = new Date(value)
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('pt-BR')
}

function renderValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
function formatCostCenterOption(option: CostCenterOption) {
  return [option.code, option.description].filter(Boolean).join(' - ')
}

function normalizeFieldType(field: CampoSchema) {
  const byType = (field.type ?? '').toLowerCase()
  if (byType) return byType
  return 'text'
}

function parseDateForInput(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return ''
  const onlyDate = value.match(/^\d{4}-\d{2}-\d{2}$/)
  if (onlyDate) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isExperienceEvaluatorField(field: CampoSchema) {
  const normalizedName = field.name.trim().toLowerCase()
  const normalizedLabel = (field.label ?? '').trim().toLowerCase()
  return (
    normalizedName === 'gestorimediatoavaliador' ||
    normalizedName === 'gestorimediatoavaliadorid' ||
    normalizedLabel.includes('gestor imediato avaliador')
  )
}

function resolveExperienceEvaluatorId(
  campos: Record<string, unknown>,
  evaluators: ResponsibleOption[],
) {
  const byIdKey = normalizeText(campos.gestorImediatoAvaliadorId)
  if (byIdKey && evaluators.some((user) => user.id === byIdKey)) return byIdKey

  const rawGestor = campos.gestorImediatoAvaliador
  if (rawGestor && typeof rawGestor === 'object' && !Array.isArray(rawGestor)) {
    const byObjectId = normalizeText((rawGestor as Record<string, unknown>).id)
    if (byObjectId && evaluators.some((user) => user.id === byObjectId)) return byObjectId
  }

  const byDirectId = normalizeText(rawGestor)
  if (byDirectId && evaluators.some((user) => user.id === byDirectId)) return byDirectId

  const byName = normalizeText(rawGestor).toLocaleLowerCase('pt-BR')
  if (!byName) return ''
  return evaluators.find((user) => user.fullName.trim().toLocaleLowerCase('pt-BR') === byName)?.id ?? ''
}

export default function FluxoSolicitacaoClient() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [result, setResult] = useState<FluxoResponse | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('fluxo')

   const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editFields, setEditFields] = useState<Record<string, unknown>>({})
  const [editReason, setEditReason] = useState('')

  const [statusValue, setStatusValue] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [statusReason, setStatusReason] = useState('')

  const nextStep = useMemo(() => result?.historico.find((item) => item.status === 'PENDENTE') ?? null, [result])

  function resetEditor(data: FluxoResponse) {
    setEditTitle(data.valoresEdicao.titulo)
    setEditDescription(data.valoresEdicao.descricao ?? '')
    const normalizedFields = Object.fromEntries(
      Object.entries(data.valoresEdicao.campos ?? {}).map(([key, value]) => [key, value ?? '']),
    )
    const shouldNormalizeEvaluator = data.formSchema.some((field) => isExperienceEvaluatorField(field))
    if (shouldNormalizeEvaluator) {
      const evaluatorOptions = data.dataSources.experienceEvaluators ?? []
      const evaluatorId = resolveExperienceEvaluatorId(normalizedFields, evaluatorOptions)
      if (evaluatorId) {
        const evaluatorName =
          evaluatorOptions.find((user) => user.id === evaluatorId)?.fullName ?? ''
        normalizedFields.gestorImediatoAvaliadorId = evaluatorId
        normalizedFields.gestorImediatoAvaliador = evaluatorName
      }
    }
    setEditFields(normalizedFields)    
    setEditReason('')

    setStatusValue(data.statusAtual)
    setDepartmentId(data.metadata.departamentoAtualId ?? '')
    setResponsavelId(data.metadata.responsavelAtualId ?? '')
    setStatusReason('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/solicitacoes/fluxo/${encodeURIComponent(query.trim())}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        if (response.status === 404) {
          setResult(null)
          setError('Solicitação não encontrada.')
          return
        }
        throw new Error('Não foi possível carregar o fluxo.')
      }

      const data = (await response.json()) as FluxoResponse
      setResult(data)
      setActiveTab('fluxo')
      resetEditor(data)
    } catch (err: any) {
      setResult(null)
      setError(err?.message ?? 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshCurrent() {
    if (!result?.solicitacao.id) return
    const response = await fetch(`/api/solicitacoes/fluxo/${encodeURIComponent(result.solicitacao.id)}`, { cache: 'no-store' })
    if (!response.ok) return
    const data = (await response.json()) as FluxoResponse
    setResult(data)
    resetEditor(data)
  }

  async function saveEditFields() {
    if (!result) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/solicitacoes/fluxo/${result.solicitacao.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'EDIT_FIELDS',
          titulo: editTitle,
          descricao: editDescription || null,
          campos: editFields,
          reason: editReason || undefined,
        }),
      })
           const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível salvar as alterações.')
      setSuccess('Dados do chamado atualizados com sucesso.')
      await refreshCurrent()
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao atualizar campos.')
    } finally {
      setSaving(false)
    }
  }

   function inferFieldSourceOptions(field: CampoSchema) {
    const normalizedName = field.name.toLowerCase()
    if (isExperienceEvaluatorField(field)) {
      return result?.dataSources.experienceEvaluators?.map((user) => ({ value: user.id, label: user.fullName })) ?? []
    }
    if (field.type === 'cost_center' || normalizedName.includes('centrocusto') || normalizedName.includes('costcenter')) {
      return result?.dataSources.costCenters.map((center) => ({
        value: center.id,
        label: formatCostCenterOption(center),
      })) ?? []
    }
    if (field.source === 'users' || normalizedName.includes('usuario') || normalizedName.includes('gestor')) {
      return result?.dataSources.users.map((user) => ({ value: user.id, label: user.fullName })) ?? []
    }
    if (field.source === 'departments' || normalizedName.includes('departamento')) {
      return result?.dataSources.departments.map((department) => ({ value: department.id, label: department.name })) ?? []
    }
    if (field.source === 'positions' || normalizedName.includes('cargo')) {
      return result?.dataSources.positions.map((position) => ({ value: position.id, label: position.name })) ?? []
    }
    return []
  }

  function renderEditField(field: CampoSchema) {
    const fieldType = normalizeFieldType(field)
    const fieldValue = editFields[field.name]
    const label = field.label?.trim() || field.name
    const isEvaluatorField = isExperienceEvaluatorField(field)
    const dynamicOptions = inferFieldSourceOptions(field)
    const options = (field.options ?? []).map((opt) => ({ value: opt, label: opt }))
    const resolvedOptions = options.length > 0 ? options : dynamicOptions
    const required = Boolean(field.required)
    const disabled = Boolean(field.disabled)
    const readOnly = Boolean(field.readOnly)
    const placeholder = field.placeholder ?? ''

    if (fieldType === 'checkbox' || fieldType === 'boolean') {
      return (
        <label key={field.name} className="flex items-start gap-2 rounded-md border border-slate-200 p-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(fieldValue)}
            disabled={disabled || readOnly}
            onChange={(e) => setEditFields((prev) => ({ ...prev, [field.name]: e.target.checked }))}
          />
          <span className="text-slate-700">
            {label}
            {required ? <span className="ml-1 text-red-500">*</span> : null}
          </span>
        </label>
      )
    }

    if (fieldType === 'radio' && resolvedOptions.length > 0) {
      const current = typeof fieldValue === 'string' ? fieldValue : ''
      return (
        <div key={field.name} className="block text-sm">
          <span className="mb-1 block text-slate-700">{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span>
          <div className="flex flex-wrap gap-3">
            {resolvedOptions.map((option) => (
              <label key={option.value} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name={`edit-${field.name}`}
                  value={option.value}
                  checked={current === option.value}
                  disabled={disabled || readOnly}
                  onChange={(e) => setEditFields((prev) => ({ ...prev, [field.name]: e.target.value }))}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )
    }

    if (fieldType === 'multiselect' || fieldType === 'multi_select') {
      const values = Array.isArray(fieldValue) ? fieldValue.map(String) : []
      return (
        <label key={field.name} className="block text-sm">
          <span className="mb-1 block text-slate-600">{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span>
          <select
            multiple
            value={values}
            required={required}
            disabled={disabled || readOnly}
            onChange={(e) => {
              const next = Array.from(e.target.selectedOptions).map((option) => option.value)
              setEditFields((prev) => ({ ...prev, [field.name]: next }))
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            {resolvedOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      )
    }

     if ((isEvaluatorField || fieldType === 'select' || fieldType === 'cost_center' || fieldType === 'autocomplete') && resolvedOptions.length > 0) {
      const selectedValue = fieldValue == null ? '' : String(fieldValue)
      const selected = resolvedOptions.some((option) => option.value === selectedValue) ? selectedValue : ''
      return (
        <label key={field.name} className="block text-sm">
          <span className="mb-1 block text-slate-600">{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span>
          <select
            value={selected}
            required={required}
            disabled={disabled || readOnly}
            onChange={(e) => {
              const selectedId = e.target.value
              setEditFields((prev) => {
                if (!isEvaluatorField) return { ...prev, [field.name]: selectedId }
                const selectedEvaluator = resolvedOptions.find((option) => option.value === selectedId)
                return {
                  ...prev,
                  [field.name]: selectedId,
                  gestorImediatoAvaliadorId: selectedId,
                  gestorImediatoAvaliador: selectedEvaluator?.label ?? '',
                }
              })
            }}            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Selecione...</option>
            {resolvedOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      )
    }

    if (fieldType === 'textarea') {
      return (
        <label key={field.name} className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span>
          <textarea
            value={typeof fieldValue === 'string' ? fieldValue : String(fieldValue ?? '')}
            placeholder={placeholder}
            required={required}
            disabled={disabled || readOnly}
            onChange={(e) => setEditFields((prev) => ({ ...prev, [field.name]: e.target.value }))}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            rows={4}
          />
        </label>
      )
    }

    const inputType = fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'
    const normalizedValue =
      inputType === 'date'
        ? parseDateForInput(fieldValue)
        : typeof fieldValue === 'number'
          ? String(fieldValue)
          : String(fieldValue ?? '')

    return (
      <label key={field.name} className="block text-sm">
        <span className="mb-1 block text-slate-600">{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span>
        <input
          type={inputType}
          value={normalizedValue}
          placeholder={placeholder}
          required={required}
          readOnly={readOnly}
          disabled={disabled}
          onChange={(e) =>
            setEditFields((prev) => ({
              ...prev,
              [field.name]: inputType === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value,
            }))
          }
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
    )
  }

  async function saveStatus() {
    if (!result) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/solicitacoes/fluxo/${result.solicitacao.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'UPDATE_STATUS',
          status: statusValue,
          departmentId: departmentId || null,
          responsavelId: responsavelId || null,
          reason: statusReason || undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível alterar status/tramitação.')
      setSuccess(`Status alterado com sucesso (${data?.from ?? 'anterior'} → ${data?.to ?? 'novo'}).`)
      await refreshCurrent()
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao alterar status.')
    } finally {
      setSaving(false)
    }
  }

  const tabs: Array<{ id: TabId; label: string; disabled?: boolean }> = [
    { id: 'fluxo', label: 'Fluxo do Chamado' },
    { id: 'dados', label: 'Dados do Chamado' },
    { id: 'editar', label: 'Editar Chamado', disabled: result ? !result.permissions.canEdit : true },
    { id: 'status', label: 'Status / Tramitação', disabled: result ? !result.permissions.canChangeStatus : true },
  ]
  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Central do Chamado - Fluxo da Solicitação</h1>
        <p className="text-sm text-slate-500">
          Busque por protocolo, id, nome do solicitante, matrícula ou tipo da solicitação para acompanhar, consultar e manter o chamado.
        </p>
      </div>

      <form onSubmit={onSubmit} className={`${card} flex flex-col gap-3 sm:flex-row`}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Protocolo, ID, solicitante, matrícula ou tipo"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

      {result && (
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-4 shadow-sm">
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <p><b>Protocolo:</b> {result.solicitacao.protocolo}</p>
              <p><b>Tipo:</b> {result.solicitacao.tipo}</p>
              <p><b>Solicitante:</b> {result.solicitacao.solicitante}</p>
              <p>
                <b>Status atual:</b>{' '}
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(result.solicitacao.status)}`}>
                  {result.solicitacao.statusLabel}
                </span>
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  disabled={tab.disabled}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-orange-500 text-white shadow'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {activeTab === 'fluxo' && (
            <div className="space-y-4">
              <section className={card}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Fluxo / Andamento Completo</h2>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <p><b>Setor responsável atual:</b> {result.etapaAtual.departamento ?? '—'}</p>
                  <p><b>Etapa atual:</b> {result.etapaAtual.nome}</p>
                  <p><b>Responsável atual:</b> {result.etapaAtual.responsavelAtual ?? '—'}</p>
                  <p><b>Data de abertura:</b> {fmtDate(result.solicitacao.dataAbertura)}</p>
                  <p><b>Data prevista:</b> {fmtDate(result.solicitacao.dataPrevista)}</p>
                  <p><b>Data de fechamento:</b> {fmtDate(result.solicitacao.dataFechamento)}</p>
                </div>
                {nextStep && <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">Próximo passo previsto: <b>{nextStep.etapa}</b></p>}
              </section>

              <section className={card}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Linha do Tempo das Etapas</h2>
                <div className="space-y-2">
                  {result.historico.map((item, index) => (
                    <div key={`${item.etapa}-${index}`} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-800">{item.etapa}</p>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{item.status}</span>
                      </div>
                      <p className="text-slate-600">Tipo: {item.tipo}</p>
                      <p className="text-slate-600">Início: {fmtDate(item.dataInicio)}</p>
                      <p className="text-slate-600">Fim: {fmtDate(item.dataFim)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className={card}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Histórico de Movimentações / Tratativas</h2>
                <div className="space-y-2">
                  {result.movimentacoes.map((item) => (
                    <div key={item.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{item.status}</span>
                        <span className="text-xs text-slate-500">{fmtDate(item.data)}</span>
                      </div>
                      <p className="mt-1 text-slate-700">{item.mensagem ?? 'Sem mensagem.'}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'dados' && (
            <section className={card}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Dados preenchidos do chamado</h2>
              <div className="space-y-4">
                {result.dadosChamado.secoes.map((secao) => (
                  <article key={secao.secao} className="rounded-md border border-slate-200 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-700">{secao.secao}</h3>
                    <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      {secao.campos.map((campo) => (
                        <p key={`${secao.secao}-${campo.chave}`}>
                          <b>{campo.chave}:</b> {renderValue(campo.valor)}
                        </p>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'editar' && (
            <section className={card}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Editar chamado</h2>
              {!result.permissions.canEdit ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">Seu perfil não possui permissão para editar os dados do chamado.</p>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Título</span>
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </label>

                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Descrição</span>
                    <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </label>

                  <div className="rounded-md border border-slate-200 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-700">Campos do formulário</h3>
                     <div className="grid gap-3 sm:grid-cols-2">
                      {result.formSchema.length > 0
                        ? result.formSchema.map(renderEditField)
                        : Object.entries(editFields).map(([key, value]) => (
                            <label key={key} className="block text-sm">
                              <span className="mb-1 block text-slate-600">{key}</span>
                              <input
                                value={String(value ?? '')}
                                onChange={(e) => setEditFields((prev) => ({ ...prev, [key]: e.target.value }))}
                                className="w-full rounded-md border border-slate-300 px-3 py-2"
                              />
                            </label>
                          ))}
                    </div>
                  </div>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Motivo da alteração (opcional)</span>
                    <input value={editReason} onChange={(e) => setEditReason(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </label>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveEditFields}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
              )}
            </section>
          )}

          {activeTab === 'status' && (
            <section className={card}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Status / Tramitação</h2>
              {!result.permissions.canChangeStatus ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">Seu perfil não possui permissão para alterar status/tramitação.</p>
              ) : (
                <div className="space-y-3">
                  <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <b>Status anterior:</b> {result.solicitacao.status} | <b>Novo status:</b> {statusValue || '—'}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-700">Novo status</span>
                      <select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2">
                        {result.statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-700">Setor responsável</span>
                      <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2">
                        <option value="">Manter atual</option>
                        {result.departamentos.map((dept) => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-700">Responsável atual</span>
                      <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2">
                        <option value="">Sem responsável definido</option>
                        {result.responsaveis.map((resp) => (
                          <option key={resp.id} value={resp.id}>{resp.fullName}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Motivo / justificativa</span>
                    <textarea value={statusReason} onChange={(e) => setStatusReason(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </label>

                  <button
                    type="button"
                    disabled={saving || !statusValue}
                    onClick={saveStatus}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {saving ? 'Aplicando...' : 'Aplicar nova tramitação'}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
