'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Mail, RefreshCcw, Save, Users } from 'lucide-react'
import { SOLICITATION_EMAIL_PLACEHOLDERS } from '@/lib/solicitationEmailTemplates'

type NodeKind = 'DEPARTMENT' | 'APPROVERS'
type LegacyNodeKind = NodeKind | 'END'

type ApiNode = {
  id: string
  label: string
  kind: NodeKind
  posX: number
  posY: number
  notificationEmails?: string[]
  notificationAdminEmails?: string[]
  notificationTemplate?: { subject: string; body: string }
  approverUserIds?: string[]
  approvalTemplate?: { subject: string; body: string }
  departmentId?: string | null
  enabled?: boolean
  notificationChannels?: {
    notifyRequester?: boolean
    notifyDepartment?: boolean
    notifyApprover?: boolean
    notifyAdmins?: boolean
  }
}

type RawApiWorkflow = {
  workflowId: string
  nodes: Array<Omit<ApiNode, 'kind'> & { kind: LegacyNodeKind }>
  edges: Array<{ id: string; source: string; target: string }>
}

type Tipo = { id: string; name: string; code?: string }

type EmailRule = {
  id: string
  order: number
  eventLabel: string
  stepKind: 'DEPARTAMENTO' | 'APROVACAO'
  stepLabel: string
  enabled: boolean
  requestType: { id: string; code: string; name: string }
  department: { id: string | null; name: string }
  template: { subject: string; body: string }
  channels: {
    notifyRequester: boolean
    notifyDepartment: boolean
    notifyApprover: boolean
    notifyAdmins: boolean
  }
  resolvedRecipients: {
    departmentUsers: Array<{ id: string; fullName: string | null; email: string }>
    approverUsers: Array<{ id: string; fullName: string | null; email: string }>
    requester: string | null
    fixedEmails: string[]
    adminEmails: string[]
    finalRecipients: string[]
  }
  diagnostics: {
    hasDepartmentRecipients: boolean
    hasApprovers: boolean
    hasFinalRecipients: boolean
    warnings: string[]
    errors: string[]
  }
}

type EmailLog = {
  id: string
  createdAt: string
  event: string
  solicitationId?: string | null
  recipients: string[]
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'TEST'
  statusLabel?: string
  error?: string | null
}

type Metrics = {
  activeRules: number
  inactiveRules: number
  stepsWithoutRecipients: number
  approvalsWithoutApprover: number
  sentToday: number
  failedToday: number
  lastError: { at: string; event: string; error?: string | null } | null
}

const DEFAULT_TEMPLATE = {
  subject: '[{tipoCodigo}] Nova etapa: {departamentoAtual}',
  body: 'Olá, o chamado {protocolo} ({tipoCodigo} - {tipoNome}) entrou na etapa {departamentoAtual}. Acesse: {link}',
}

function normalizeWorkflowGraph(workflow: RawApiWorkflow) {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node, index) => ({
      ...node,
      kind: (node.kind === 'APPROVERS' ? 'APPROVERS' : 'DEPARTMENT') as NodeKind,
      posX: Number(node.posX ?? index * 240 + 40),
      posY: Number(node.posY ?? 80),
    })),
  }
}

export function EmailControlPanel({ canEdit }: { canEdit: boolean }) {
  const [typeId, setTypeId] = useState('')
  const [types, setTypes] = useState<Tipo[]>([])
  const [workflowId, setWorkflowId] = useState('')
  const [nodes, setNodes] = useState<ApiNode[]>([])
  const [edges, setEdges] = useState<Array<{ id: string; source: string; target: string }>>([])
  const [rules, setRules] = useState<EmailRule[]>([])
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [tab, setTab] = useState<'destinatarios' | 'canais' | 'template' | 'previa' | 'historico'>('destinatarios')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const [metrics, setMetrics] = useState<Metrics>({
    activeRules: 0,
    inactiveRules: 0,
    stepsWithoutRecipients: 0,
    approvalsWithoutApprover: 0,
    sentToday: 0,
    failedToday: 0,
    lastError: null,
  })
  const [history, setHistory] = useState<EmailLog[]>([])
  const [testEmails, setTestEmails] = useState('')
  const [testMessage, setTestMessage] = useState('Teste manual da central de notificações de solicitações.')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [newFixedEmail, setNewFixedEmail] = useState('')
  const [newAdminEmail, setNewAdminEmail] = useState('')

  useEffect(() => {
    ;(async () => {
      const tiposResponse = await fetch('/api/solicitacoes/tipos', { cache: 'no-store' })
      const data: Tipo[] = await tiposResponse.json()
      setTypes(data)
      if (data[0]?.id) setTypeId(data[0].id)
    })()
  }, [])

  const refreshAll = async () => {
    if (!typeId) return
    setLoading(true)

    const [workflowResponse, dashboardResponse] = await Promise.all([
      fetch(`/api/solicitacoes/workflows?typeId=${encodeURIComponent(typeId)}`, { cache: 'no-store' }),
      fetch(`/api/solicitacoes/email-control?typeId=${encodeURIComponent(typeId)}`, { cache: 'no-store' }),
    ])

    if (workflowResponse.ok) {
      const data: RawApiWorkflow = await workflowResponse.json()
      const normalized = normalizeWorkflowGraph(data)
      setWorkflowId(normalized.workflowId)
      setNodes(normalized.nodes)
      setEdges(normalized.edges)
    }

    if (dashboardResponse.ok) {
      const data = await dashboardResponse.json()
      setMetrics(data.metrics)
      setHistory(data.history)
      setRules(data.rules)
      setUpdatedAt(new Date().toISOString())
    }

    setLoading(false)
  }

  useEffect(() => {
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId])

  const editingNode = nodes.find((node) => node.id === editingNodeId) ?? null
  const editingRule = rules.find((rule) => rule.id === editingNodeId) ?? null

  const selectedType = useMemo(() => types.find((t) => t.id === typeId) ?? null, [typeId, types])

  const updateNode = (id: string, updater: (node: ApiNode) => ApiNode) => {
    setNodes((prev) => prev.map((node) => (node.id === id ? updater(node) : node)))
  }

  const save = async () => {
    setSaving(true)
    const response = await fetch('/api/solicitacoes/workflows', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ typeId, nodes, edges }),
    })
    setSaving(false)

    if (!response.ok) {
      alert('Erro ao salvar alterações.')
      return
    }

    await refreshAll()
    alert('Alterações salvas com sucesso!')
  }

  const onTestSend = async () => {
    const recipients = testEmails.split(',').map((item) => item.trim()).filter(Boolean)
    const response = await fetch('/api/solicitacoes/email-control', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ typeId, recipients, message: testMessage }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setTestResult(`Falha: ${data.error ?? 'não foi possível enviar o teste.'}`)
      return
    }

    setTestResult(`Teste enviado com sucesso (${data.provider ?? 'provedor desconhecido'}).`)
    await refreshAll()
  }

  const mappedRules = useMemo(() => {
    return nodes
      .map((node, index) => {
        const rule = rules.find((item) => item.id === node.id)
        return { node, rule, index }
      })
      .sort((a, b) => (a.rule?.order ?? a.index) - (b.rule?.order ?? b.index))
  }, [nodes, rules])

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Central de Notificações de Solicitações</h2>
            <p className="text-sm text-slate-500">Configure quem será notificado em cada etapa do fluxo e acompanhe falhas de envio.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshAll} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm">
              <RefreshCcw size={14} /> Atualizar
            </button>
            <button disabled={!canEdit || saving} onClick={save} className="inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
              <Save size={14} /> {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Última atualização: {updatedAt ? new Date(updatedAt).toLocaleString('pt-BR') : '—'}</p>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900">
        <label className="mb-2 block text-sm font-medium">Tipo de solicitação</label>
        <select className="w-full rounded-lg border px-3 py-2" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          {types.map((tipo) => (
            <option key={tipo.id} value={tipo.id}>{tipo.name}</option>
          ))}
        </select>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
          <p><strong>Código:</strong> {selectedType?.code ?? '-'}</p>
          <p><strong>Nome:</strong> {selectedType?.name ?? '-'}</p>
          <p><strong>Etapas:</strong> {mappedRules.length}</p>
          <p><strong>Pendências:</strong> {metrics.stepsWithoutRecipients + metrics.approvalsWithoutApprover}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          ['Regras ativas', metrics.activeRules],
          ['Etapas sem destinatário', metrics.stepsWithoutRecipients],
          ['Aprovações sem aprovador', metrics.approvalsWithoutApprover],
          ['Falhas hoje', metrics.failedToday],
          ['Envios hoje', metrics.sentToday],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-white p-3 dark:bg-slate-900"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-semibold">{value}</p></div>
        ))}
        <div className="rounded-lg border bg-white p-3 dark:bg-slate-900">
          <p className="text-xs text-slate-500">Último erro</p>
          <p className="text-xs">{metrics.lastError ? `${metrics.lastError.event}: ${metrics.lastError.error ?? '-'}` : 'Sem erros recentes'}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900">
        <h3 className="mb-3 text-base font-semibold">Mapa do fluxo de notificações</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {mappedRules.map(({ node, rule, index }) => {
            const hasError = Boolean(rule?.diagnostics.errors.length)
            const hasWarning = Boolean(rule?.diagnostics.warnings.length)
            return (
              <div key={node.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">Etapa {index + 1}: {rule?.stepLabel ?? node.label}</p>
                    <p className="text-xs text-slate-500">{rule?.stepKind === 'APROVACAO' ? 'Aprovação' : 'Departamento'}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs ${(node.enabled ?? true) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{(node.enabled ?? true) ? 'Ativa' : 'Inativa'}</span>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="flex items-center gap-1"><Users size={12} /> Automáticos: {rule?.resolvedRecipients.departmentUsers.length ?? 0}</p>
                  <p className="flex items-center gap-1"><Mail size={12} /> Aprovadores: {rule?.resolvedRecipients.approverUsers.length ?? 0}</p>
                  <p>Solicitante: {rule?.channels.notifyRequester ? 'Notificado' : 'Não notificado'}</p>
                  <p>Cópias/admin: {rule?.resolvedRecipients.adminEmails.length ?? 0}</p>
                  <p>Destinatários finais: {rule?.resolvedRecipients.finalRecipients.length ?? 0}</p>
                </div>

                {hasError && <p className="mt-2 text-xs text-red-600">{rule?.diagnostics.errors.join(' ')}</p>}
                {!hasError && hasWarning && <p className="mt-2 text-xs text-amber-600">{rule?.diagnostics.warnings.join(' ')}</p>}
                {!hasError && !hasWarning && <p className="mt-2 text-xs text-emerald-600">Configuração saudável.</p>}

                <button className="mt-3 rounded border px-2 py-1 text-sm" onClick={() => { setEditingNodeId(node.id); setTab('destinatarios') }}>Configurar</button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900">
        <h3 className="mb-3 text-base font-semibold">Teste de envio</h3>
        <input className="w-full rounded border px-3 py-2" placeholder="email1@empresa.com, email2@empresa.com" value={testEmails} onChange={(e) => setTestEmails(e.target.value)} />
        <textarea className="mt-2 h-20 w-full rounded border px-3 py-2" value={testMessage} onChange={(e) => setTestMessage(e.target.value)} />
        <div className="mt-2 flex items-center gap-3">
          <button type="button" onClick={onTestSend} disabled={!canEdit} className="rounded border px-3 py-2">Enviar teste</button>
          {testResult && <p className="text-sm text-slate-700">{testResult}</p>}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900">
        <h3 className="mb-3 text-base font-semibold">Histórico geral</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-slate-500"><th className="py-2">Data/Hora</th><th>Evento</th><th>Protocolo</th><th>Destinatários</th><th>Resultado</th><th>Erro</th></tr></thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-b align-top">
                  <td className="py-2">{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                  <td>{item.event}</td>
                  <td>{item.solicitationId ?? '-'}</td>
                  <td className="text-xs">{item.recipients.join(', ') || '-'}</td>
                  <td>{item.statusLabel ?? item.status}</td>
                  <td className="text-xs text-red-600">{item.error ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {loading && <div className="rounded-xl border bg-slate-50 p-3 text-sm">Carregando dados da central...</div>}

      {editingNode && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl space-y-4 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Configurar regra: {editingRule?.stepLabel ?? editingNode.label}</h2>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => setEditingNodeId(null)}>Fechar</button>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                ['destinatarios', 'Destinatários'],
                ['canais', 'Canais'],
                ['template', 'Template'],
                ['previa', 'Prévia'],
                ['historico', 'Histórico da etapa'],
              ].map(([key, label]) => (
                <button key={key} className={`rounded px-3 py-1 text-sm ${tab === key ? 'bg-slate-900 text-white' : 'border'}`} onClick={() => setTab(key as typeof tab)}>{label}</button>
              ))}
            </div>

            {tab === 'destinatarios' && (
              <div className="space-y-3 text-sm">
                <section className="rounded border p-3">
                  <p className="font-medium">Automáticos por departamento</p>
                  <p className="text-xs text-slate-500">Origem: departamento da etapa + acesso mínimo ao módulo.</p>
                  <ul className="mt-2 list-disc pl-5 text-xs">
                    {(editingRule?.resolvedRecipients.departmentUsers ?? []).map((user) => <li key={user.id}>{user.fullName ?? user.email} ({user.email})</li>)}
                  </ul>
                </section>
                <section className="rounded border p-3">
                  <p className="font-medium">Aprovadores</p>
                  <ul className="mt-2 list-disc pl-5 text-xs">
                    {(editingRule?.resolvedRecipients.approverUsers ?? []).map((user) => <li key={user.id}>{user.fullName ?? user.email} ({user.email})</li>)}
                  </ul>
                </section>
                <section className="rounded border p-3">
                  <p className="font-medium">Destinatários fixos e cópias/admin</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium">Fixos</p>
                      <div className="mb-2 mt-1 flex gap-2"><input className="flex-1 rounded border px-2 py-2" value={newFixedEmail} onChange={(e) => setNewFixedEmail(e.target.value)} placeholder="email@empresa.com" /><button className="rounded border px-3" onClick={() => { if (!newFixedEmail.trim()) return; updateNode(editingNode.id, (node) => ({ ...node, notificationEmails: Array.from(new Set([...(node.notificationEmails ?? []), newFixedEmail.trim()])) })); setNewFixedEmail('') }}>Adicionar</button></div>
                      <p className="text-xs">{(editingNode.notificationEmails ?? []).join(', ') || 'Nenhum'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium">Cópias/admin</p>
                      <div className="mb-2 mt-1 flex gap-2"><input className="flex-1 rounded border px-2 py-2" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="grupo@empresa.com" /><button className="rounded border px-3" onClick={() => { if (!newAdminEmail.trim()) return; updateNode(editingNode.id, (node) => ({ ...node, notificationAdminEmails: Array.from(new Set([...(node.notificationAdminEmails ?? []), newAdminEmail.trim()])) })); setNewAdminEmail('') }}>Adicionar</button></div>
                      <p className="text-xs">{(editingNode.notificationAdminEmails ?? []).join(', ') || 'Nenhum'}</p>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {tab === 'canais' && (
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <label className="flex items-center gap-2 rounded border p-2"><input type="checkbox" checked={editingNode.notificationChannels?.notifyDepartment ?? true} onChange={(e) => updateNode(editingNode.id, (node) => ({ ...node, notificationChannels: { ...node.notificationChannels, notifyDepartment: e.target.checked } }))} /> Notificar setor responsável</label>
                <label className="flex items-center gap-2 rounded border p-2"><input type="checkbox" checked={editingNode.notificationChannels?.notifyApprover ?? (editingNode.kind === 'APPROVERS')} onChange={(e) => updateNode(editingNode.id, (node) => ({ ...node, notificationChannels: { ...node.notificationChannels, notifyApprover: e.target.checked } }))} /> Notificar aprovador</label>
                <label className="flex items-center gap-2 rounded border p-2"><input type="checkbox" checked={editingNode.notificationChannels?.notifyRequester ?? false} onChange={(e) => updateNode(editingNode.id, (node) => ({ ...node, notificationChannels: { ...node.notificationChannels, notifyRequester: e.target.checked } }))} /> Notificar solicitante</label>
                <label className="flex items-center gap-2 rounded border p-2"><input type="checkbox" checked={editingNode.notificationChannels?.notifyAdmins ?? false} onChange={(e) => updateNode(editingNode.id, (node) => ({ ...node, notificationChannels: { ...node.notificationChannels, notifyAdmins: e.target.checked } }))} /> Copiar admins/grupo</label>
              </div>
            )}

            {tab === 'template' && (
              <div className="space-y-2">
                <input className="w-full rounded border px-2 py-2" value={editingNode.kind === 'APPROVERS' ? editingNode.approvalTemplate?.subject ?? DEFAULT_TEMPLATE.subject : editingNode.notificationTemplate?.subject ?? DEFAULT_TEMPLATE.subject} onChange={(e) => updateNode(editingNode.id, (node) => node.kind === 'APPROVERS' ? { ...node, approvalTemplate: { subject: e.target.value, body: node.approvalTemplate?.body ?? DEFAULT_TEMPLATE.body } } : { ...node, notificationTemplate: { subject: e.target.value, body: node.notificationTemplate?.body ?? DEFAULT_TEMPLATE.body } })} />
                <textarea className="h-40 w-full rounded border px-2 py-2" value={editingNode.kind === 'APPROVERS' ? editingNode.approvalTemplate?.body ?? DEFAULT_TEMPLATE.body : editingNode.notificationTemplate?.body ?? DEFAULT_TEMPLATE.body} onChange={(e) => updateNode(editingNode.id, (node) => node.kind === 'APPROVERS' ? { ...node, approvalTemplate: { subject: node.approvalTemplate?.subject ?? DEFAULT_TEMPLATE.subject, body: e.target.value } } : { ...node, notificationTemplate: { subject: node.notificationTemplate?.subject ?? DEFAULT_TEMPLATE.subject, body: e.target.value } })} />
                <div className="rounded bg-slate-50 p-3 text-xs text-slate-600">Placeholders: {SOLICITATION_EMAIL_PLACEHOLDERS.join(', ')}</div>
              </div>
            )}

            {tab === 'previa' && (
              <div className="rounded border p-3 text-sm">
                <p className="mb-2 font-medium">Prévia de destinatários finais</p>
                <p className="text-xs">{editingRule?.resolvedRecipients.finalRecipients.join(', ') || 'Nenhum destinatário final.'}</p>
                <p className="mt-2 text-xs"><strong>Assunto:</strong> {editingRule?.template.subject || '-'}</p>
                <p className="text-xs whitespace-pre-line"><strong>Corpo:</strong> {editingRule?.template.body || '-'}</p>
              </div>
            )}

            {tab === 'historico' && (
              <div className="space-y-2 text-sm">
                {history.filter((item) => item.event.includes(editingRule?.order ? `etapa_${editingRule.order}` : 'notificacao_aprovador')).slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded border p-2">
                    <p className="text-xs">{new Date(item.createdAt).toLocaleString('pt-BR')} - {item.statusLabel ?? item.status}</p>
                    <p className="text-xs">{item.recipients.join(', ') || '-'}</p>
                    {item.error && <p className="text-xs text-red-600">{item.error}</p>}
                  </div>
                ))}
              </div>
            )}

            {(editingRule?.diagnostics.errors.length ?? 0) > 0 && (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-center gap-2"><AlertTriangle size={14} /> {editingRule?.diagnostics.errors.join(' ')}</div>
            )}
            {(editingRule?.diagnostics.errors.length ?? 0) === 0 && (editingRule?.diagnostics.warnings.length ?? 0) > 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700 flex items-center gap-2"><AlertTriangle size={14} /> {editingRule?.diagnostics.warnings.join(' ')}</div>
            )}
            {(editingRule?.diagnostics.errors.length ?? 0) === 0 && (editingRule?.diagnostics.warnings.length ?? 0) === 0 && (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700 flex items-center gap-2"><CheckCircle2 size={14} /> Regra configurada com segurança.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
