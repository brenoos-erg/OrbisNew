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
  notificationEmails?: string[]
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
    { order: 1, stepKey: 'INICIO', label: 'Setor inicial', kind: 'DEPARTAMENTO', canAssume: true, notificationEmails: [] },
    { order: 2, stepKey: 'APROVACAO', label: 'Aprovação', kind: 'APROVACAO', requiresApproval: true, notificationEmails: [] },
    { order: 3, stepKey: 'FIM', label: 'Fim', kind: 'FIM', canFinalize: true, notificationEmails: [] },
  ],
  transitions: [
    { fromStepKey: 'INICIO', toStepKey: 'APROVACAO' },
    { fromStepKey: 'APROVACAO', toStepKey: 'FIM' },
  ],
}
function toStep(order: number, stepKey: string, label: string, kind: Kind, defaults?: Partial<StepDraft>): StepDraft {
  return {
    order,
    stepKey,
    label,
    kind,
    notificationEmails: [],
    ...defaults,
  }
}

function buildWorkflowTemplates(tipos: RefItem[]): WorkflowDraft[] {
  const tipoByName = (needle: string) => tipos.find((tipo) => (tipo.nome ?? '').toUpperCase().includes(needle.toUpperCase()))?.id
  const tipoById = (id: string) => tipos.find((tipo) => tipo.id === id)?.id

  return [
    {
      name: 'RQ.063 - Solicitação de Pessoal',
      tipoId: tipoById('RQ_063') ?? tipoByName('RQ.063') ?? '',
      departmentId: null,
      active: true,
      steps: [
        toStep(1, 'USUARIO_ABRE', 'Usuário abre chamado', 'DEPARTAMENTO', { canAssume: true }),
        toStep(2, 'VALIDA_CONTRATO', 'Validação: vaga prevista em contrato?', 'APROVACAO', { requiresApproval: true }),
        toStep(3, 'APROVACAO_GESTAO', 'Aprovação de gestão (quando não prevista)', 'APROVACAO', { requiresApproval: true }),
        toStep(4, 'RH_PREENCHIMENTO', 'RH preenche dados do funcionário', 'DEPARTAMENTO'),
        toStep(5, 'DP_ADMISSAO', 'DP recebe Solicitação de Admissão', 'DEPARTAMENTO', { canFinalize: true }),
        toStep(6, 'FIM', 'Finalização DP', 'FIM', { canFinalize: true }),
      ],
      transitions: [
        { fromStepKey: 'USUARIO_ABRE', toStepKey: 'VALIDA_CONTRATO' },
        { fromStepKey: 'VALIDA_CONTRATO', toStepKey: 'RH_PREENCHIMENTO' },
        { fromStepKey: 'VALIDA_CONTRATO', toStepKey: 'APROVACAO_GESTAO' },
        { fromStepKey: 'APROVACAO_GESTAO', toStepKey: 'RH_PREENCHIMENTO' },
        { fromStepKey: 'RH_PREENCHIMENTO', toStepKey: 'DP_ADMISSAO' },
        { fromStepKey: 'DP_ADMISSAO', toStepKey: 'FIM' },
      ],
    },
    {
      name: 'RQ.247 - Desligamento de Pessoal',
      tipoId: tipoById('RQ_247') ?? tipoByName('RQ.247') ?? '',
      departmentId: null,
      active: true,
      steps: [
        toStep(1, 'USUARIO_ABRE', 'Usuário abre chamado', 'DEPARTAMENTO', { canAssume: true }),
        toStep(2, 'APROVACAO_USUARIO', 'Aprovação obrigatória', 'APROVACAO', { requiresApproval: true }),
        toStep(3, 'DP_COPIA', 'Cópia enviada ao Departamento Pessoal', 'DEPARTAMENTO'),
        toStep(4, 'DP_TRATATIVA', 'Departamento Pessoal trata e finaliza', 'DEPARTAMENTO', { canFinalize: true }),
      ],
      transitions: [
        { fromStepKey: 'USUARIO_ABRE', toStepKey: 'APROVACAO_USUARIO' },
        { fromStepKey: 'APROVACAO_USUARIO', toStepKey: 'DP_COPIA' },
        { fromStepKey: 'DP_COPIA', toStepKey: 'DP_TRATATIVA' },
      ],
    },
    {
      name: 'RQ.088 - Solicitação de Veículos',
      tipoId: tipoById('RQ_088') ?? tipoByName('RQ.088') ?? '',
      departmentId: null,
      active: true,
      steps: [
        toStep(1, 'USUARIO_ABRE', 'Usuário abre chamado', 'DEPARTAMENTO', { canAssume: true }),
        toStep(2, 'APROVACAO_GESTOR', 'Gestor do departamento aprova', 'APROVACAO', { requiresApproval: true }),
        toStep(3, 'LOGISTICA', 'Chamado direcionado para Logística', 'DEPARTAMENTO', { canFinalize: true }),
      ],
      transitions: [
        { fromStepKey: 'USUARIO_ABRE', toStepKey: 'APROVACAO_GESTOR' },
        { fromStepKey: 'APROVACAO_GESTOR', toStepKey: 'LOGISTICA' },
      ],
    },
    {
      name: 'Solicitação de Férias',
      tipoId: tipoById('AGENDAMENTO_DE_FERIAS') ?? tipoByName('FÉRIAS') ?? '',
      departmentId: null,
      active: true,
      steps: [
        toStep(1, 'USUARIO_ABRE', 'Usuário abre chamado', 'DEPARTAMENTO', { canAssume: true }),
        toStep(2, 'APROVACAO_GESTOR', 'Gestor do departamento aprova', 'APROVACAO', { requiresApproval: true }),
        toStep(3, 'DP', 'Direciona para Departamento Pessoal', 'DEPARTAMENTO', { canFinalize: true }),
      ],
      transitions: [
        { fromStepKey: 'USUARIO_ABRE', toStepKey: 'APROVACAO_GESTOR' },
        { fromStepKey: 'APROVACAO_GESTOR', toStepKey: 'DP' },
      ],
    },
    {
      name: 'RQ.092 - Solicitação de Exames',
      tipoId: tipoById('RQ_092') ?? tipoByName('RQ.092') ?? '',
      departmentId: null,
      active: true,
      steps: [
        toStep(1, 'USUARIO_ABRE', 'Usuário abre chamado', 'DEPARTAMENTO', { canAssume: true }),
        toStep(2, 'SST', 'Segurança do Trabalho trata', 'DEPARTAMENTO', { canFinalize: true }),
      ],
      transitions: [{ fromStepKey: 'USUARIO_ABRE', toStepKey: 'SST' }],
    },
    {
      name: 'RQ.043 - Requisição de EPI / Uniformes',
      tipoId: tipoById('RQ_043') ?? tipoByName('RQ.043') ?? '',
      departmentId: null,
      active: true,
      steps: [
        toStep(1, 'USUARIO_ABRE', 'Usuário abre chamado', 'DEPARTAMENTO', { canAssume: true }),
        toStep(2, 'SST_VALIDA_ANEXO', 'SST valida se há anexo / anexa quando necessário', 'DEPARTAMENTO'),
        toStep(3, 'APROVADOR_SETOR', 'Aprovador do setor aprova', 'APROVACAO', { requiresApproval: true }),
        toStep(4, 'LOGISTICA', 'Logística recebe chamado', 'DEPARTAMENTO', { canFinalize: true }),
      ],
      transitions: [
        { fromStepKey: 'USUARIO_ABRE', toStepKey: 'SST_VALIDA_ANEXO' },
        { fromStepKey: 'SST_VALIDA_ANEXO', toStepKey: 'APROVADOR_SETOR' },
        { fromStepKey: 'APROVADOR_SETOR', toStepKey: 'LOGISTICA' },
      ],
    },
    {
      name: 'RQ.089 - Solicitação de Equipamento',
      tipoId: tipoById('RQ_089') ?? tipoByName('RQ.089') ?? '',
      departmentId: null,
      active: true,
      steps: [
        toStep(1, 'USUARIO_ABRE', 'Usuário abre chamado', 'DEPARTAMENTO', { canAssume: true }),
        toStep(2, 'TI', 'Chamado direcionado para Tecnologia da Informação', 'DEPARTAMENTO', { canFinalize: true }),
      ],
      transitions: [{ fromStepKey: 'USUARIO_ABRE', toStepKey: 'TI' }],
    },
  ].filter((item) => item.tipoId)
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

  async function saveWorkflow(model = draft) {
    setSaving(true)
    const url = model.id ? `/api/solicitation-workflows/${model.id}` : '/api/solicitation-workflows'
    const method = model.id ? 'PUT' : 'POST'

    await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(model),
    })

    await loadData()
    if (!model.id) setDraft(emptyDraft)
    setSaving(false)
  }
  async function applyPresetFlows() {
    const templates = buildWorkflowTemplates(tipos)
    for (const template of templates) {
      const existing = workflows.find((wf) => wf.tipoId === template.tipoId)
      await saveWorkflow(existing ? { ...template, id: existing.id } : template)
    }
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
        </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-sm font-medium">Aprovadores e e-mails por etapa (regra padrão de disparo)</p>
        <div className="space-y-3">
          {nodes.map((step, idx) => (
            <div key={step.stepKey} className="grid gap-2 rounded border p-2 md:grid-cols-2">
              <div className="text-sm font-medium">{idx + 1}. {step.label} ({step.kind})</div>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="rounded border px-2 py-1 text-sm"
                  placeholder="ID do aprovador"
                  value={step.approverUserId ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, steps: prev.steps.map((s) => s.stepKey === step.stepKey ? { ...s, approverUserId: e.target.value || null } : s) }))}
                />
                <input
                  className="rounded border px-2 py-1 text-sm"
                  placeholder="emails@empresa.com, outro@empresa.com"
                  value={(step.notificationEmails ?? []).join(', ')}
                  onChange={(e) => setDraft((prev) => ({
                    ...prev,
                    steps: prev.steps.map((s) => s.stepKey === step.stepKey
                      ? { ...s, notificationEmails: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }
                      : s),
                  }))}
                />
              </div>
            </div>
          ))}
        </div>
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
       <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={saving || !draft.name || !draft.tipoId} onClick={() => saveWorkflow()}>
          {saving ? 'Salvando...' : draft.id ? 'Atualizar workflow' : 'Salvar workflow'}
        </button>
        <button className="rounded border px-4 py-2 text-sm disabled:opacity-50" disabled={saving || tipos.length === 0} onClick={applyPresetFlows}>
          Aplicar fluxos padrão solicitados
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