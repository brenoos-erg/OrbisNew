'use client'

import Link from 'next/link'
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

type NonConformityActionStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA'
type NonConformityActionType = 'ACAO_CORRETIVA' | 'ACAO_PREVENTIVA' | 'CORRECAO'

type CostCenter = { id: string; code: string; description: string }
type Gestor = { id: string; userId: string; user: { id: string; fullName: string | null; email: string } }

type ActionItem = {
  id: string
  descricao: string
  status: NonConformityActionStatus
  createdAt: string
  updatedAt?: string
  referencia?: string | null
  origem?: string | null
  prazo?: string | null
  responsavelNome?: string | null
  atividadeComo?: string | null
  motivoBeneficio?: string | null
  dataInicioPrevista?: string | null
  dataFimPrevista?: string | null
  custo?: number | null
  tipo?: NonConformityActionType | null
  dataConclusao?: string | null
  centroResponsavelId?: string | null
  responsavelId?: string | null
  evidencias?: string | null
  rapidez?: number | null
  autonomia?: number | null
  beneficio?: number | null
   createdBy?: { fullName?: string | null; email?: string | null } | null
}

type PlanoResponse = { item?: ActionItem; error?: string }
type PlanoListResponse = { items?: ActionItem[]; error?: string }
type GestoresResponse = { members?: Gestor[] }
type UploadResponse = { url?: string; uploadedAt?: string; uploadedBy?: string; originalName?: string; error?: string }

type TabKey = 'plano' | 'causa'
type ModalTab = 'dados' | 'evidencias'

const STATUS_OPTIONS: NonConformityActionStatus[] = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']
const TYPE_OPTIONS: NonConformityActionType[] = ['ACAO_CORRETIVA', 'ACAO_PREVENTIVA', 'CORRECAO']
const STATUS_LABELS: Record<NonConformityActionStatus, string> = { PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' }
const TYPE_LABELS: Record<NonConformityActionType, string> = { ACAO_CORRETIVA: 'Ação corretiva', ACAO_PREVENTIVA: 'Ação preventiva', CORRECAO: 'Correção' }

function toDateInput(value?: string | null) { return value ? String(value).slice(0, 10) : '' }
function parseJsonSafe<T>(res: Response): Promise<T | null> { return res.json().catch(() => null) }
function getOnde(origem?: string | null) { return origem?.startsWith('LOCAL:') ? origem.replace('LOCAL:', '') : origem || '' }
function buildOrigem(onde?: string) { const v = (onde || '').trim(); return v ? `LOCAL:${v}` : null }
function toCostCenterLabel(center?: CostCenter | null) { return center ? `${center.code} - ${center.description}` : '' }
function formatDate(value?: string | null) { if (!value) return '-'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR') }

function parseEvidenceList(text?: string | null) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

type ParsedEvidenceFile = {
  type: 'file'
  raw: string
  url: string
  displayName: string
  uploadedAt?: string | null
  uploadedBy?: string | null
}

type ParsedEvidenceNote = {
  type: 'note'
  raw: string
  message: string
  uploadedAt?: string | null
  uploadedBy?: string | null
}

type ParsedEvidenceItem = ParsedEvidenceFile | ParsedEvidenceNote
function normalizeEvidenceEntry(entry: string) {
  const trimmed = entry.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/public/uploads/')) return trimmed.replace('/public/uploads/', '/uploads/')
  if (trimmed.startsWith('public/uploads/')) return `/${trimmed.replace(/^public\//, '')}`
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`
  return trimmed
}

function toFileViewUrl(entry: string) {
  const normalized = normalizeEvidenceEntry(entry)
  if (/^https?:\/\//i.test(normalized)) return normalized
  if (normalized.startsWith('/uploads/')) {
    const relative = normalized.replace(/^\/uploads\//, '')
    return `/api/files/${relative.split('/').map(encodeURIComponent).join('/')}`
  }
  return normalized
}

function parseLegacyEvidenceNote(entry: string): Pick<ParsedEvidenceNote, 'message' | 'uploadedAt' | 'uploadedBy'> {
  const match = entry.match(/^\[([^\]]+)\]\s*([^:]+):\s*(.+)$/)
  if (!match) return { message: entry }
  return {
    uploadedAt: match[1] || null,
    uploadedBy: match[2]?.trim() || null,
    message: match[3]?.trim() || entry,
  }
}

function parseEvidenceItem(entry: string): ParsedEvidenceItem {
  const trimmed = entry.trim()
  if (!trimmed) return { type: 'note', raw: entry, message: '' }

  if (trimmed.startsWith('FILE|')) {
    const [, rawUrl = '', encodedName = '', uploadedAt = '', encodedBy = ''] = trimmed.split('|')
    const normalizedUrl = normalizeEvidenceEntry(decodeURIComponent(rawUrl))
    return {
      type: 'file',
      raw: entry,
      url: normalizedUrl,
      displayName: decodeURIComponent(encodedName || '') || getEvidenceName(normalizedUrl),
      uploadedAt: uploadedAt || null,
      uploadedBy: decodeURIComponent(encodedBy || '') || null,
    }
  }

  const normalizedEntry = normalizeEvidenceEntry(trimmed)
  const isUrl = /^https?:\/\//i.test(normalizedEntry) || normalizedEntry.startsWith('/uploads/') || normalizedEntry.startsWith('/api/files/')
  if (isUrl) {
    const defaultName = getEvidenceName(normalizedEntry)
    const fromTimestamp = defaultName.match(/^(\d{13})-/)
    const uploadedAt = fromTimestamp?.[1] ? new Date(Number(fromTimestamp[1])).toISOString() : null
    return {
      type: 'file',
      raw: entry,
      url: normalizedEntry,
      displayName: defaultName,
      uploadedAt,
      uploadedBy: null,
    }
  }

  const note = parseLegacyEvidenceNote(trimmed)
  return {
    type: 'note',
    raw: entry,
    message: note.message,
    uploadedAt: note.uploadedAt,
    uploadedBy: note.uploadedBy,
  }
}

function formatEvidenceMetaDate(value?: string | null) {
  if (!value) return 'Não informado'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('pt-BR')
}

function serializeUploadedEvidence(url: string, originalName: string, uploadedAt?: string, uploadedBy?: string) {
  const safeName = encodeURIComponent(originalName || getEvidenceName(url))
  const safeBy = encodeURIComponent(uploadedBy || '')
  return `FILE|${encodeURIComponent(url)}|${safeName}|${uploadedAt || ''}|${safeBy}`
}

function getEvidenceName(entry: string) {
  const normalized = normalizeEvidenceEntry(entry)
  if (!normalized) return 'Arquivo'
  const withoutQuery = normalized.split('?')[0]
  const name = withoutQuery.split('/').pop()
  return name || 'Arquivo'
}

function RadarPreview({ rapidez, autonomia, beneficio }: { rapidez: number; autonomia: number; beneficio: number }) {
  const base = 100
  const scale = 14
  const angles = [-90, 30, 150]
  const values = [rapidez, autonomia, beneficio]
  const points = values.map((value, index) => {
    const radius = value * scale
    const rad = (angles[index] * Math.PI) / 180
    const x = base + Math.cos(rad) * radius
    const y = base + Math.sin(rad) * radius
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width="220" height="220" viewBox="0 0 220 220" className="mx-auto">
      {[1,2,3,4,5].map((step) => <circle key={step} cx="100" cy="100" r={step * scale} fill="none" stroke="#e2e8f0" strokeWidth="1" />)}
      <polygon points={points} fill="rgba(59,130,246,0.35)" stroke="#2563eb" strokeWidth="2" />
      <text x="98" y="16" className="fill-slate-500 text-[10px]">Rapidez</text>
      <text x="168" y="144" className="fill-slate-500 text-[10px]">Autonomia</text>
      <text x="12" y="144" className="fill-slate-500 text-[10px]">Benefício</text>
    </svg>
  )
}

export default function PlanoAvulsoDetailClient({ actionId }: { actionId: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingEvidence, setUploadingEvidence] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('plano')

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

  const [causaRaiz, setCausaRaiz] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<ModalTab>('dados')
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null)
  const [actionForm, setActionForm] = useState({
    descricao: '', motivo: '', como: '', onde: '', quem: '', centroResponsavelId: '', dataInicio: '', dataFim: '', status: 'PENDENTE' as NonConformityActionStatus,
    tipo: 'ACAO_CORRETIVA' as NonConformityActionType, origem: '', referencia: '', historico: '', dataConclusao: '', custo: '', rapidez: 1, autonomia: 1, beneficio: 1,
    evidencias: '',
  })

   const rootAction = useMemo(() => allActions.find((a) => a.id === actionId) ?? allActions[0] ?? null, [allActions, actionId])
  const planReference = rootAction?.referencia || rootAction?.id || actionId
  const childActions = useMemo(() => allActions.filter((a) => a.id !== rootAction?.id), [allActions, rootAction])
  const evidenceItems = useMemo(() => parseEvidenceList(evidencias).map(parseEvidenceItem), [evidencias])

 const load = useCallback(async () => {
    try {
      setLoading(true)
      const [res, centersRes, gestoresRes] = await Promise.all([
        fetch(`/api/sst/plano-de-acao/${actionId}`, { cache: 'no-store' }),
        fetch('/api/cost-centers/select', { cache: 'no-store' }),
        fetch('/api/configuracoes/gestores', { cache: 'no-store' }),
      ])
      const data = await parseJsonSafe<PlanoResponse>(res)
      if (!res.ok || !data?.item) throw new Error(data?.error || 'Erro ao carregar plano.')

      setCostCenters((await parseJsonSafe<CostCenter[]>(centersRes)) || [])
      const gestoresData = await parseJsonSafe<GestoresResponse>(gestoresRes)
      setGestores(Array.isArray(gestoresData?.members) ? gestoresData.members : [])

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
      const actionsRes = await fetch(`/api/sst/plano-de-acao?referencia=${encodeURIComponent(item.referencia || item.id)}`, { cache: 'no-store' })
      const actionsData = await parseJsonSafe<PlanoListResponse>(actionsRes)
      setAllActions(actionsRes.ok && Array.isArray(actionsData?.items) ? actionsData.items : [item])
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar plano.')
    } finally {
      setLoading(false)
    }
  }, [actionId])

  useEffect(() => { void load() }, [load])

  function openNewActionModal() {
    setEditingAction(null)
    setActionForm({ descricao: '', motivo: '', como: '', onde: '', quem: '', centroResponsavelId: '', dataInicio: '', dataFim: '', status: 'PENDENTE', tipo: 'ACAO_CORRETIVA', origem: '', referencia: planReference, historico: '', dataConclusao: '', custo: '', rapidez: 1, autonomia: 1, beneficio: 1, evidencias: '' })
    setModalTab('dados')
    setModalOpen(true)
  }

  function openEditActionModal(action: ActionItem) {
    setEditingAction(action)
    setActionForm({
      descricao: action.descricao || '', motivo: action.motivoBeneficio || '', como: action.atividadeComo || '', onde: getOnde(action.origem), quem: action.responsavelNome || '',
      centroResponsavelId: action.centroResponsavelId || '', dataInicio: toDateInput(action.dataInicioPrevista), dataFim: toDateInput(action.dataFimPrevista || action.prazo), status: action.status,
      tipo: action.tipo || 'ACAO_CORRETIVA', origem: action.origem || '', referencia: action.referencia || planReference, historico: action.evidencias || '',
      dataConclusao: toDateInput(action.dataConclusao), custo: action.custo != null ? String(action.custo) : '', rapidez: action.rapidez || 1, autonomia: action.autonomia || 1, beneficio: action.beneficio || 1,
      evidencias: action.evidencias || '',
    })
    setModalTab('dados')
    setModalOpen(true)
  }

 async function uploadEvidence(file: File, onSuccess: (serializedEntry: string) => void) {
    try {
      setUploadingEvidence(true)
      const body = new FormData(); body.set('file', file)
      const res = await fetch('/api/uploads?scope=plano-acao-avulso', { method: 'POST', body })

      const data = await parseJsonSafe<UploadResponse>(res)

      if (!res.ok || !data?.url) throw new Error(data?.error || 'Falha no upload do arquivo.')
      onSuccess(serializeUploadedEvidence(data.url, data.originalName || file.name, data.uploadedAt, data.uploadedBy))
    } catch (e: any) {
      setError(e?.message || 'Falha no upload do arquivo.')
    } finally {
      setUploadingEvidence(false)
    }
  }

  async function savePlan() {
    try {
      setSaving(true)
      const selectedGestor = gestores.find((g) => g.userId === responsavelId)
      const responsavelFinal = selectedGestor?.user.fullName || selectedGestor?.user.email || responsavelNome || null
      const res = await fetch(`/api/sst/plano-de-acao/${rootAction?.id || actionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: objetivo, atividadeComo: resultadoEsperado, dataInicioPrevista: dataInicioPrevista || null, dataFimPrevista: dataFimPrevista || null, status, custo: investimento ? Number(investimento) : null, tipo, dataConclusao: dataConclusao || null, centroResponsavelId: centroResponsavelId || null, responsavelId: responsavelId || null, responsavelNome: responsavelFinal, evidencias, referencia: planReference, origem: causaRaiz || null, prazo: dataFimPrevista || null }),
      })
      const data = await parseJsonSafe<{ error?: string }>(res)
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar plano.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar plano.')
    } finally {
      setSaving(false)
    }
  }

  async function saveAction() {
    try {
      setSaving(true)
      const payload = {
        descricao: actionForm.descricao.trim(), motivoBeneficio: actionForm.motivo || null, atividadeComo: actionForm.como || null, origem: buildOrigem(actionForm.onde),
        responsavelNome: actionForm.quem.trim() || null, centroResponsavelId: actionForm.centroResponsavelId || null, dataInicioPrevista: actionForm.dataInicio || null, dataFimPrevista: actionForm.dataFim || null,
        prazo: actionForm.dataFim || null, status: actionForm.status, tipo: actionForm.tipo, referencia: actionForm.referencia || planReference, dataConclusao: actionForm.dataConclusao || null,
        custo: actionForm.custo ? Number(actionForm.custo) : null, rapidez: actionForm.rapidez, autonomia: actionForm.autonomia, beneficio: actionForm.beneficio, evidencias: actionForm.evidencias || null,
      }
      if (!payload.descricao) throw new Error('Informe o campo O que?.')
      const res = editingAction
        ? await fetch(`/api/sst/plano-de-acao/${editingAction.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/sst/plano-de-acao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await parseJsonSafe<{ error?: string }>(res)
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar ação.')
      setModalOpen(false)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar ação.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteActionRow(action: ActionItem) {
    if (!window.confirm('Deseja excluir esta ação?')) return
    try {
      setSaving(true)
      const res = await fetch(`/api/sst/plano-de-acao/${action.id}`, { method: 'DELETE' })
      const data = await parseJsonSafe<{ error?: string }>(res)
      if (!res.ok) throw new Error(data?.error || 'Erro ao excluir ação.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao excluir ação.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-600">Carregando plano...</p>

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <header className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <h1 className="text-2xl font-semibold text-slate-800">Plano de Ação</h1>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={savePlan} disabled={saving} className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar / Atualizar'}</button>
          <Link href="/dashboard/sgi/qualidade/planos-de-acao" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">Sair</Link>
        </div>
      </header>

      <div className="flex gap-1 border-b border-slate-300 px-2">
        <button type="button" onClick={() => setActiveTab('plano')} className={`rounded-t border px-3 py-1 text-sm ${activeTab === 'plano' ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-600'}`}>Plano de Ação</button>
        <button type="button" onClick={() => setActiveTab('causa')} className={`rounded-t border px-3 py-1 text-sm ${activeTab === 'causa' ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-600'}`}>Estudo de Causa</button>
      </div>

      {activeTab === 'plano' && (
        <section className="space-y-4">
          <Block title="Dados principais"><div className="grid gap-3 md:grid-cols-2"><Field label="Código"><input value={planReference} readOnly className="input bg-slate-50" /></Field><Field label="Objetivo"><textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} rows={3} className="input" /></Field><Field label="Resultado esperado" className="md:col-span-2"><textarea value={resultadoEsperado} onChange={(e) => setResultadoEsperado(e.target.value)} rows={3} className="input" /></Field></div></Block>

          <Block title="Planejamento"><div className="grid gap-3 md:grid-cols-3"><Field label="Prev. início"><input type="date" value={dataInicioPrevista} onChange={(e) => setDataInicioPrevista(e.target.value)} className="input" /></Field><Field label="Prev. fim"><input type="date" value={dataFimPrevista} onChange={(e) => setDataFimPrevista(e.target.value)} className="input" /></Field><Field label="Data conclusão"><input type="date" value={dataConclusao} onChange={(e) => setDataConclusao(e.target.value)} className="input" /></Field><Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as NonConformityActionStatus)} className="input">{STATUS_OPTIONS.map((o) => <option key={o} value={o}>{STATUS_LABELS[o]}</option>)}</select></Field><Field label="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value as NonConformityActionType)} className="input">{TYPE_OPTIONS.map((o) => <option key={o} value={o}>{TYPE_LABELS[o]}</option>)}</select></Field></div></Block>

          <Block title="Responsáveis"><div className="grid gap-3 md:grid-cols-2"><Field label="Centro responsável"><select value={centroResponsavelId} onChange={(e) => setCentroResponsavelId(e.target.value)} className="input"><option value="">Selecione</option>{costCenters.map((cc) => <option key={cc.id} value={cc.id}>{toCostCenterLabel(cc)}</option>)}</select></Field><Field label="Responsável"><select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="input"><option value="">Selecione</option>{gestores.map((g) => <option key={g.id} value={g.userId}>{g.user.fullName || g.user.email}</option>)}</select></Field>{!responsavelId && <Field label="Nome do responsável" className="md:col-span-2"><input value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} className="input" /></Field>}</div></Block>

          <Block title="Financeiro"><Field label="Investimento"><input type="number" step="0.01" value={investimento} onChange={(e) => setInvestimento(e.target.value)} className="input" /></Field></Block>

          <Block title="Ações" highlight>
            <div className="mb-3 flex justify-end"><button type="button" onClick={openNewActionModal} className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">Nova ação</button></div>
            <div className="overflow-x-auto rounded border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left"><tr><th className="px-2 py-2">Status</th><th className="px-2 py-2">Nº Processo</th><th className="px-2 py-2">Data criação</th><th className="px-2 py-2">O que?</th><th className="px-2 py-2">Onde?</th><th className="px-2 py-2">Ações</th></tr></thead>
                <tbody>{childActions.map((a) => <tr key={a.id} className="border-t"><td className="px-2 py-2">{STATUS_LABELS[a.status]}</td><td className="px-2 py-2">{a.referencia || '-'}</td><td className="px-2 py-2">{formatDate(a.createdAt)}</td><td className="px-2 py-2">{a.descricao}</td><td className="px-2 py-2">{getOnde(a.origem) || '-'}</td><td className="px-2 py-2"><div className="flex gap-2"><button type="button" onClick={() => openEditActionModal(a)} className="rounded bg-sky-600 px-2 py-1 text-xs text-white">Editar</button><button type="button" onClick={() => deleteActionRow(a)} className="rounded bg-rose-600 px-2 py-1 text-xs text-white">Excluir</button></div></td></tr>)}{childActions.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-center text-slate-500">Nenhuma ação cadastrada.</td></tr>}</tbody>
              </table>

              </div>
          </Block>

          <Block title="Evidências" highlight>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600">📎 Adicionar evidência
                <input type="file" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; await uploadEvidence(file, (url) => setEvidencias((prev) => `${prev ? `${prev}\n` : ''}${url}`)); e.currentTarget.value = '' }} />
              </label>
              {uploadingEvidence && <span className="text-sm text-slate-600">Enviando...</span>}
             </div>
            <textarea value={evidencias} onChange={(e) => setEvidencias(e.target.value)} rows={4} className="input" />
            <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">{evidenceItems.length === 0 ? <p className="text-sm text-slate-500">Nenhuma evidência anexada.</p> : evidenceItems.map((item, idx) => {
              if (item.type === 'file') {
                const fileViewUrl = toFileViewUrl(item.url)
                return (
                  <article key={`${item.raw}-${idx}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-800">📎 {item.displayName}</p>
                        <p className="text-xs text-slate-500">Data/hora: {formatEvidenceMetaDate(item.uploadedAt)}</p>
                        <p className="text-xs text-slate-500">Usuário: {item.uploadedBy || 'Não informado'}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={fileViewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">👁️ Visualizar</a>
                        <a href={fileViewUrl} download className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">⬇️ Baixar</a>
                      </div>
                    </div>
                  </article>
                )
              }

              return (
                <article key={`${item.raw}-${idx}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Observação</p>
                  <p className="mt-1 text-sm text-amber-900">{item.message}</p>
                  <p className="mt-2 text-xs text-amber-700">Autor: {item.uploadedBy || 'Não informado'} · Data/hora: {formatEvidenceMetaDate(item.uploadedAt)}</p>
                </article>
              )
            })}</div>
          </Block>
        </section>
      )}

      {activeTab === 'causa' && (
        <Block title="Estudo de causa"><Field label="Causa raiz"><textarea value={causaRaiz} onChange={(e) => setCausaRaiz(e.target.value)} rows={4} className="input" /></Field></Block>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[95vh] w-full max-w-6xl overflow-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="text-lg font-semibold">{editingAction ? 'Editar ação' : 'Nova ação'}</h2><button type="button" onClick={() => setModalOpen(false)} className="rounded border px-2 py-1 text-sm">Fechar</button></div>
           <div className="flex gap-1 border-b px-4"><button type="button" onClick={() => setModalTab('dados')} className={`rounded-t border px-3 py-2 text-sm ${modalTab === 'dados' ? 'bg-white text-blue-700' : 'bg-slate-100'}`}>Ação - Dados Básicos</button><button type="button" onClick={() => setModalTab('evidencias')} className={`rounded-t border px-3 py-2 text-sm ${modalTab === 'evidencias' ? 'bg-white text-blue-700' : 'bg-slate-100'}`}>Evidências</button></div>
            {modalTab === 'dados' ? <div className="grid gap-4 p-4 lg:grid-cols-[2fr_1fr]"><div className="grid gap-3 md:grid-cols-2"><Field label="Nº Processo"><input value={actionForm.referencia} onChange={(e) => setActionForm((p) => ({ ...p, referencia: e.target.value }))} className="input" /></Field><Field label="Criado em"><input value={editingAction ? formatDate(editingAction.createdAt) : '-'} readOnly className="input bg-slate-50" /></Field><Field label="Criado por"><input value={editingAction?.createdBy?.fullName || editingAction?.createdBy?.email || '-'} readOnly className="input bg-slate-50" /></Field><Field label="Última atualização"><input value={editingAction ? formatDate(editingAction.updatedAt) : '-'} readOnly className="input bg-slate-50" /></Field><Field label="O que?" className="md:col-span-2"><textarea value={actionForm.descricao} onChange={(e) => setActionForm((p) => ({ ...p, descricao: e.target.value }))} rows={2} className="input" /></Field><Field label="Por quê?"><textarea value={actionForm.motivo} onChange={(e) => setActionForm((p) => ({ ...p, motivo: e.target.value }))} rows={2} className="input" /></Field><Field label="Como?"><textarea value={actionForm.como} onChange={(e) => setActionForm((p) => ({ ...p, como: e.target.value }))} rows={2} className="input" /></Field><Field label="Onde?"><input value={actionForm.onde} onChange={(e) => setActionForm((p) => ({ ...p, onde: e.target.value }))} className="input" /></Field><Field label="Quem?"><input value={actionForm.quem} onChange={(e) => setActionForm((p) => ({ ...p, quem: e.target.value }))} className="input" /></Field><Field label="Centro responsável"><select value={actionForm.centroResponsavelId} onChange={(e) => setActionForm((p) => ({ ...p, centroResponsavelId: e.target.value }))} className="input"><option value="">Selecione</option>{costCenters.map((cc) => <option key={cc.id} value={cc.id}>{toCostCenterLabel(cc)}</option>)}</select></Field><Field label="Início"><input type="date" value={actionForm.dataInicio} onChange={(e) => setActionForm((p) => ({ ...p, dataInicio: e.target.value }))} className="input" /></Field><Field label="Fim"><input type="date" value={actionForm.dataFim} onChange={(e) => setActionForm((p) => ({ ...p, dataFim: e.target.value }))} className="input" /></Field><Field label="Status"><select value={actionForm.status} onChange={(e) => setActionForm((p) => ({ ...p, status: e.target.value as NonConformityActionStatus }))} className="input">{STATUS_OPTIONS.map((o) => <option key={o} value={o}>{STATUS_LABELS[o]}</option>)}</select></Field><Field label="Tipo"><select value={actionForm.tipo} onChange={(e) => setActionForm((p) => ({ ...p, tipo: e.target.value as NonConformityActionType }))} className="input">{TYPE_OPTIONS.map((o) => <option key={o} value={o}>{TYPE_LABELS[o]}</option>)}</select></Field><Field label="Origem"><input value={actionForm.origem} onChange={(e) => setActionForm((p) => ({ ...p, origem: e.target.value }))} className="input" /></Field><Field label="Referência"><input value={actionForm.referencia} onChange={(e) => setActionForm((p) => ({ ...p, referencia: e.target.value }))} className="input" /></Field><Field label="Histórico (somente leitura)" className="md:col-span-2"><textarea value={actionForm.historico} readOnly rows={2} className="input bg-slate-50" /></Field><Field label="Data conclusão"><input type="date" value={actionForm.dataConclusao} onChange={(e) => setActionForm((p) => ({ ...p, dataConclusao: e.target.value }))} className="input" /></Field><Field label="Quanto? (custo)"><input type="number" step="0.01" value={actionForm.custo} onChange={(e) => setActionForm((p) => ({ ...p, custo: e.target.value }))} className="input" /></Field></div><aside className="rounded-lg border border-slate-200 bg-slate-50 p-3"><h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Gráfico RAB - média</h3><RadarPreview rapidez={actionForm.rapidez} autonomia={actionForm.autonomia} beneficio={actionForm.beneficio} /><Field label="Rapidez"><input type="number" min={1} max={5} value={actionForm.rapidez} onChange={(e) => setActionForm((p) => ({ ...p, rapidez: Number(e.target.value || 1) }))} className="input" /></Field><Field label="Autonomia"><input type="number" min={1} max={5} value={actionForm.autonomia} onChange={(e) => setActionForm((p) => ({ ...p, autonomia: Number(e.target.value || 1) }))} className="input" /></Field><Field label="Benefício"><input type="number" min={1} max={5} value={actionForm.beneficio} onChange={(e) => setActionForm((p) => ({ ...p, beneficio: Number(e.target.value || 1) }))} className="input" /></Field></aside></div> : <div className="space-y-3 p-4"><label className="inline-flex cursor-pointer items-center gap-2 rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600">📎 Adicionar evidência<input type="file" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; await uploadEvidence(file, (serializedEntry) => setActionForm((p) => ({ ...p, evidencias: `${p.evidencias ? `${p.evidencias}\n` : ''}${serializedEntry}` }))); e.currentTarget.value = '' }} /></label><textarea value={actionForm.evidencias} onChange={(e) => setActionForm((p) => ({ ...p, evidencias: e.target.value }))} rows={5} className="input" /><div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">{parseEvidenceList(actionForm.evidencias).map((entry, idx) => { const item = parseEvidenceItem(entry); if (item.type === 'file') { const fileViewUrl = toFileViewUrl(item.url); return <article key={`${entry}-${idx}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1"><p className="text-sm font-semibold text-slate-800">📎 {item.displayName}</p><p className="text-xs text-slate-500">Data/hora: {formatEvidenceMetaDate(item.uploadedAt)}</p><p className="text-xs text-slate-500">Usuário: {item.uploadedBy || 'Não informado'}</p></div><div className="flex flex-wrap items-center gap-2"><a href={fileViewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">👁️ Visualizar</a><a href={fileViewUrl} download className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">⬇️ Baixar</a></div></div></article> } return <article key={`${entry}-${idx}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Observação</p><p className="mt-1 text-sm text-amber-900">{item.message}</p><p className="mt-2 text-xs text-amber-700">Autor: {item.uploadedBy || 'Não informado'} · Data/hora: {formatEvidenceMetaDate(item.uploadedAt)}</p></article> })}</div></div>}
            <div className="flex justify-end gap-2 border-t px-4 py-3"><button type="button" onClick={() => setModalOpen(false)} className="rounded border px-3 py-2 text-sm">Cancelar</button><button type="button" onClick={saveAction} disabled={saving} className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white">{saving ? 'Salvando...' : 'Salvar ação'}</button></div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  )
}

function Block({ title, children, highlight = false }: { title: string; children: ReactNode; highlight?: boolean }) {
  return <section className={`rounded-xl border p-4 ${highlight ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'}`}><h2 className="mb-3 text-base font-semibold text-slate-800">{title}</h2>{children}</section>
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block text-sm font-medium text-slate-700 ${className}`}><span>{label}</span><div className="mt-1">{children}</div></label>
}