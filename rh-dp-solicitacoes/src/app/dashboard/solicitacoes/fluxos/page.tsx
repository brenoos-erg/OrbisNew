'use client'

import { useEffect, useMemo, useState } from 'react'

type RefItem = { id: string; nome?: string; name?: string }
type Kind = 'DEPARTAMENTO' | 'APROVACAO' | 'FIM'

type StepDraft = {
  order: number
  stepKey: string
  label: string
  kind: Kind
  defaultDepartmentId?: string | null
  requiresApproval?: boolean
  approverGroupId?: string | null
  approverUserId?: string | null
  canAssume?: boolean
  canFinalize?: boolean
}

type TransitionDraft = { fromStepKey: string; toStepKey: string }

type WorkflowDraft = {
  id?: string
  name: string
  tipoId: string
  departmentId?: string | null
  active: boolean
  steps: StepDraft[]
  transitions: TransitionDraft[]
}

const emptyDraft: WorkflowDraft = {
  name: '',
  tipoId: '',
  departmentId: null,
  active: true,
  steps: [
    { order: 1, stepKey: 'INICIO', label: 'Setor inicial', kind: 'DEPARTAMENTO', canAssume: true },
    { order: 2, stepKey: 'APROVACAO', label: 'Aprovação', kind: 'APROVACAO', requiresApproval: true },
    { order: 3, stepKey: 'FIM', label: 'Fim', kind: 'FIM', canFinalize: true },
  ],
  transitions: [
    { fromStepKey: 'INICIO', toStepKey: 'APROVACAO' },
    { fromStepKey: 'APROVACAO', toStepKey: 'FIM' },
  ],
}

export default function FluxosSolicitacoesPage() {
  const [tipos, setTipos] = useState<RefItem[]>([])
  const [departments, setDepartments] = useState<RefItem[]>([])
  const [workflows, setWorkflows] = useState<WorkflowDraft[]>([])
  const [draft, setDraft] = useState<WorkflowDraft>(emptyDraft)
  const [saving, setSaving] = useState(false)

  async function loadData() {
    const [tiposRes, depRes, wfRes] = await Promise.all([
      fetch('/api/tipos-solicitacao', { cache: 'no-store' }),
      fetch('/api/departments', { cache: 'no-store' }),
      fetch('/api/solicitation-workflows', { cache: 'no-store' }),
    ])

    setTipos(await tiposRes.json())
    setDepartments(await depRes.json())
    setWorkflows(await wfRes.json())
  }

  useEffect(() => {
    loadData()
  }, [])

  const nodes = useMemo(() => [...draft.steps].sort((a, b) => a.order - b.order), [draft.steps])

  async function saveWorkflow() {
    setSaving(true)
    const url = draft.id ? `/api/solicitation-workflows/${draft.id}` : '/api/solicitation-workflows'
    const method = draft.id ? 'PUT' : 'POST'

    await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(draft),
    })

    await loadData()
    if (!draft.id) setDraft(emptyDraft)
    setSaving(false)
  }

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <h1 className="text-xl font-semibold">Fluxo de Solicitações</h1>

      <div className="grid gap-3 md:grid-cols-2">
        <input className="rounded border px-3 py-2" placeholder="Nome do workflow" value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
        <select className="rounded border px-3 py-2" value={draft.tipoId} onChange={(e) => setDraft((prev) => ({ ...prev, tipoId: e.target.value }))}>
          <option value="">Tipo de solicitação</option>
          {tipos.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}
        </select>
        <select className="rounded border px-3 py-2" value={draft.departmentId ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, departmentId: e.target.value || null }))}>
          <option value="">Fallback geral</option>
          {departments.map((dep) => <option key={dep.id} value={dep.id}>{dep.name}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-sm font-medium text-slate-700">Pré-visualização do fluxo</p>
        <svg width="100%" height="180" viewBox="0 0 980 180" className="overflow-visible">
          {nodes.map((step, idx) => {
            const x = 20 + idx * 300
            const y = 55
            const isApproval = step.kind === 'APROVACAO'
            return (
              <g key={step.stepKey}>
                {isApproval ? (
                  <polygon points={`${x + 110},${y} ${x + 220},${y + 45} ${x + 110},${y + 90} ${x},${y + 45}`} fill="#fef3c7" stroke="#f59e0b" />
                ) : (
                  <rect x={x} y={y} rx="8" width="220" height="90" fill="#ffffff" stroke="#94a3b8" />
                )}
                <text x={x + 110} y={y + 45} dominantBaseline="middle" textAnchor="middle" className="fill-slate-700 text-xs">{step.label}</text>
                {idx < nodes.length - 1 && <line x1={x + 220} y1={y + 45} x2={x + 300} y2={y + 45} stroke="#64748b" strokeWidth="2" markerEnd="url(#arr)" />}
              </g>
            )
          })}
          <defs>
            <marker id="arr" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 Z" fill="#64748b" /></marker>
          </defs>
        </svg>
      </div>

      <div className="flex gap-2">
        <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={saving || !draft.name || !draft.tipoId} onClick={saveWorkflow}>
          {saving ? 'Salvando...' : draft.id ? 'Atualizar workflow' : 'Salvar workflow'}
        </button>
      </div>

      <div className="rounded-xl border">
        <div className="border-b px-3 py-2 text-sm font-medium">Workflows cadastrados</div>
        <div className="divide-y">
          {workflows.map((wf) => (
            <button key={wf.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => setDraft(wf)}>
              {wf.name} • {tipos.find((t) => t.id === wf.tipoId)?.nome ?? wf.tipoId}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}