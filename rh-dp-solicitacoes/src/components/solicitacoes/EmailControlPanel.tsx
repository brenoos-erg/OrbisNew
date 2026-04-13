'use client'
import { useEffect, useMemo, useState } from 'react'
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

type ApiWorkflow = {
  workflowId: string
  nodes: ApiNode[]
  edges: Array<{ id: string; source: string; target: string }>
}

type RawApiWorkflow = {
  workflowId: string
  nodes: Array<Omit<ApiNode, 'kind'> & { kind: LegacyNodeKind }>
  edges: Array<{ id: string; source: string; target: string }>
}

type Tipo = { id: string; name: string }
type EmailLog = {
  id: string
  createdAt: string
  event: string
  solicitationId?: string | null
  recipients: string[]
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'TEST'
  error?: string | null
}

type Metrics = {
  activeRules: number
  inactiveRules: number
  sentToday: number
  failedToday: number
  lastError: { at: string; event: string; error?: string | null } | null
}

const DEFAULT_TEMPLATE = {
  subject: '[{tipoCodigo}] Nova etapa: {departamentoAtual}',
  body: 'Olá, o chamado {protocolo} ({tipoCodigo} - {tipoNome}) entrou na etapa {departamentoAtual}. Acesse: {link}',
}

function normalizeWorkflowGraph(workflow: RawApiWorkflow | ApiWorkflow): ApiWorkflow {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node, index) => ({
      ...node,
      kind: (node.kind === 'APPROVERS' ? 'APPROVERS' : 'DEPARTMENT') as NodeKind,
      posX: Number(node.posX ?? index * 240 + 40),
      posY: Number(node.posY ?? 80),
    })),
    edges: workflow.edges,
  }
}

export function EmailControlPanel({ canEdit }: { canEdit: boolean }) {
  const [typeId, setTypeId] = useState('')
  const [types, setTypes] = useState<Tipo[]>([])
  const [workflowId, setWorkflowId] = useState('')
  const [nodes, setNodes] = useState<ApiNode[]>([])
  const [edges, setEdges] = useState<ApiWorkflow['edges']>([])
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [filters, setFilters] = useState({ event: '', status: 'all', result: 'all', from: '', to: '' })
  const [metrics, setMetrics] = useState<Metrics>({ activeRules: 0, inactiveRules: 0, sentToday: 0, failedToday: 0, lastError: null })
  const [history, setHistory] = useState<EmailLog[]>([])

  const [testEmails, setTestEmails] = useState('')
  const [testMessage, setTestMessage] = useState('Teste manual do painel de controle de e-mails de solicitações.')
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

  useEffect(() => {
    if (!typeId) return
    ;(async () => {
      const response = await fetch(`/api/solicitacoes/workflows?typeId=${encodeURIComponent(typeId)}`, { cache: 'no-store' })
      if (!response.ok) return
      const data: RawApiWorkflow = await response.json()
      const normalized = normalizeWorkflowGraph(data)
      setWorkflowId(normalized.workflowId)
      setNodes(normalized.nodes)
      setEdges(normalized.edges)
    })()
  }, [typeId])

  const loadDashboard = async () => {
    if (!typeId) return
    const params = new URLSearchParams({ typeId })
    if (filters.event) params.set('event', filters.event)
    if (filters.status !== 'all') params.set('status', filters.status)
    if (filters.result !== 'all') params.set('result', filters.result)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)

    const response = await fetch(`/api/solicitacoes/email-control?${params.toString()}`, { cache: 'no-store' })
    if (!response.ok) return
    const data = await response.json()
    setMetrics(data.metrics)
    setHistory(data.history)
  }

  useEffect(() => {
    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId, filters])

  const orderedNodes = useMemo(() => {
    const nextBySource = new Map<string, string[]>()
    const hasIncoming = new Set<string>()
    for (const edge of edges) {
      nextBySource.set(edge.source, [...(nextBySource.get(edge.source) ?? []), edge.target])
      hasIncoming.add(edge.target)
    }
    const start = nodes.find((node) => !hasIncoming.has(node.id))
    if (!start) return nodes

    const ordered: ApiNode[] = []
    const visited = new Set<string>()
    let current: string | undefined = start.id
    while (current && !visited.has(current)) {
      visited.add(current)
      const node = nodes.find((item) => item.id === current)
      if (node) ordered.push(node)
      current = nextBySource.get(current)?.[0]
    }

    for (const node of nodes) if (!visited.has(node.id)) ordered.push(node)
    return ordered
  }, [nodes, edges])

  const editingNode = nodes.find((node) => node.id === editingNodeId) ?? null

  const updateNode = (id: string, updater: (node: ApiNode) => ApiNode) => {
    setNodes((prev) => prev.map((node) => (node.id === id ? updater(node) : node)))
  }

  const onSave = async () => {
    setSaving(true)
    const response = await fetch('/api/solicitacoes/workflows', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ typeId, nodes, edges }),
    })

    setSaving(false)
    if (!response.ok) {
      alert('Erro ao salvar configurações de e-mail.')
      return
    }

    await loadDashboard()
    alert('Configurações salvas com sucesso!')
  }

  const onTestSend = async () => {
    const recipients = testEmails
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const response = await fetch('/api/solicitacoes/email-control', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ typeId, recipients, message: testMessage }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setTestResult(`Falha: ${data.error ?? 'não foi possível enviar.'}`)
      return
    }

    setTestResult(`Teste enviado com sucesso (${data.provider ?? 'provedor desconhecido'}).`)
    await loadDashboard()
  }

  const statusBadge = (status: string) => {
    if (status === 'SUCCESS' || status === 'TEST') return 'bg-emerald-50 text-emerald-700'
    if (status === 'FAILED') return 'bg-red-50 text-red-700'
    return 'bg-amber-50 text-amber-700'
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-lg border bg-white p-3"><p className="text-xs text-slate-500">Regras ativas</p><p className="text-2xl font-semibold">{metrics.activeRules}</p></div>
        <div className="rounded-lg border bg-white p-3"><p className="text-xs text-slate-500">Regras inativas</p><p className="text-2xl font-semibold">{metrics.inactiveRules}</p></div>
        <div className="rounded-lg border bg-white p-3"><p className="text-xs text-slate-500">Envios hoje</p><p className="text-2xl font-semibold">{metrics.sentToday}</p></div>
        <div className="rounded-lg border bg-white p-3"><p className="text-xs text-slate-500">Falhas hoje</p><p className="text-2xl font-semibold text-red-600">{metrics.failedToday}</p></div>
        <div className="rounded-lg border bg-white p-3"><p className="text-xs text-slate-500">Último erro</p><p className="text-xs">{metrics.lastError ? `${metrics.lastError.event}: ${metrics.lastError.error ?? '-'}` : 'Sem erros recentes'}</p></div>
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="text-base font-semibold">Filtros operacionais</h2>
        <div className="grid gap-2 md:grid-cols-6">
          <select className="rounded border px-2 py-2" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.name}</option>)}
          </select>
          <input className="rounded border px-2 py-2" placeholder="Evento" value={filters.event} onChange={(e) => setFilters((prev) => ({ ...prev, event: e.target.value }))} />
          <select className="rounded border px-2 py-2" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="all">Ativo/Inativo</option><option value="active">Ativo</option><option value="inactive">Inativo</option>
          </select>
          <select className="rounded border px-2 py-2" value={filters.result} onChange={(e) => setFilters((prev) => ({ ...prev, result: e.target.value }))}>
            <option value="all">Sucesso/Falha</option><option value="success">Sucesso</option><option value="failed">Falha</option>
          </select>
          <input type="date" className="rounded border px-2 py-2" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
          <input type="date" className="rounded border px-2 py-2" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Regras de disparo por etapa ({orderedNodes.length})</h2>
          <button type="button" onClick={onSave} disabled={!canEdit || saving} className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">{saving ? 'Salvando...' : 'Salvar alterações'}</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-slate-500"><th className="py-2">Evento</th><th>Tipo</th><th>Setor</th><th>Destinatários</th><th>Status</th><th>Template</th><th>Ações</th></tr></thead>
            <tbody>
              {orderedNodes.map((node, idx) => (
                <tr key={node.id} className="border-b align-top">
                  <td className="py-2">{node.kind === 'APPROVERS' ? 'Notificação para aprovador' : `Mudança para etapa ${idx + 1}`}</td>
                  <td>{node.kind === 'APPROVERS' ? 'Aprovação' : 'Departamento'}</td>
                  <td>{node.label}</td>
                  <td className="text-xs text-slate-600">{(node.notificationEmails ?? []).slice(0, 2).join(', ') || 'Automático por regra'}</td>
                  <td><span className={`rounded-full px-2 py-1 text-xs ${(node.enabled ?? true) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{(node.enabled ?? true) ? 'Ativo' : 'Inativo'}</span></td>
                  <td className="text-xs">{node.kind === 'APPROVERS' ? 'approvalTemplate' : 'notificationTemplate'}</td>
                  <td><button className="rounded border px-2 py-1" onClick={() => setEditingNodeId(node.id)}>Configurar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-2">
        <h2 className="text-base font-semibold">Teste de envio</h2>
        <input className="w-full rounded border px-3 py-2" placeholder="email1@empresa.com, email2@empresa.com" value={testEmails} onChange={(e) => setTestEmails(e.target.value)} />
        <textarea className="h-20 w-full rounded border px-3 py-2" value={testMessage} onChange={(e) => setTestMessage(e.target.value)} />
        <div className="flex items-center gap-3">
          <button type="button" onClick={onTestSend} disabled={!canEdit} className="rounded border px-3 py-2">Testar envio</button>
          {testResult && <p className="text-sm text-slate-700">{testResult}</p>}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold">Histórico de envios</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-slate-500"><th className="py-2">Data/Hora</th><th>Evento</th><th>Solicitação</th><th>Destinatários</th><th>Status</th><th>Erro</th></tr></thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-b align-top">
                  <td className="py-2">{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                  <td>{item.event}</td>
                  <td>{item.solicitationId ?? '-'}</td>
                  <td className="text-xs">{item.recipients.join(', ') || '-'}</td>
                  <td><span className={`rounded-full px-2 py-1 text-xs ${statusBadge(item.status)}`}>{item.status}</span></td>
                  <td className="text-xs text-red-600">{item.error ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingNode && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Configurar regra: {editingNode.label}</h2>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => setEditingNodeId(null)}>Fechar</button>
            </div>

            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingNode.enabled ?? true} onChange={(e) => updateNode(editingNode.id, (node) => ({ ...node, enabled: e.target.checked }))} /> Regra ativa</label>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingNode.notificationChannels?.notifyRequester ?? false} onChange={(e) => updateNode(editingNode.id, (node) => ({ ...node, notificationChannels: { ...node.notificationChannels, notifyRequester: e.target.checked } }))} /> Notificar solicitante</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingNode.notificationChannels?.notifyDepartment ?? true} onChange={(e) => updateNode(editingNode.id, (node) => ({ ...node, notificationChannels: { ...node.notificationChannels, notifyDepartment: e.target.checked } }))} /> Notificar setor responsável</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingNode.notificationChannels?.notifyApprover ?? (editingNode.kind === 'APPROVERS')} onChange={(e) => updateNode(editingNode.id, (node) => ({ ...node, notificationChannels: { ...node.notificationChannels, notifyApprover: e.target.checked } }))} /> Notificar aprovador</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingNode.notificationChannels?.notifyAdmins ?? false} onChange={(e) => updateNode(editingNode.id, (node) => ({ ...node, notificationChannels: { ...node.notificationChannels, notifyAdmins: e.target.checked } }))} /> Copiar admins/grupo</label>
            </div>

            <div className="rounded border p-3">
              <p className="mb-2 text-sm font-medium">Destinatários fixos</p>
              <div className="mb-2 flex gap-2"><input className="flex-1 rounded border px-2 py-2" value={newFixedEmail} onChange={(e) => setNewFixedEmail(e.target.value)} placeholder="email@empresa.com" /><button className="rounded border px-3" onClick={() => { if (!newFixedEmail.trim()) return; updateNode(editingNode.id, (node) => ({ ...node, notificationEmails: Array.from(new Set([...(node.notificationEmails ?? []), newFixedEmail.trim()])) })); setNewFixedEmail('') }}>Adicionar</button></div>
              <div className="flex flex-wrap gap-2">{(editingNode.notificationEmails ?? []).map((email) => <span key={email} className="rounded-full bg-slate-100 px-2 py-1 text-xs">{email}</span>)}</div>
            </div>

            <div className="rounded border p-3">
              <p className="mb-2 text-sm font-medium">E-mails de cópia/admin</p>
              <div className="mb-2 flex gap-2"><input className="flex-1 rounded border px-2 py-2" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="grupo@empresa.com" /><button className="rounded border px-3" onClick={() => { if (!newAdminEmail.trim()) return; updateNode(editingNode.id, (node) => ({ ...node, notificationAdminEmails: Array.from(new Set([...(node.notificationAdminEmails ?? []), newAdminEmail.trim()])) })); setNewAdminEmail('') }}>Adicionar</button></div>
              <div className="flex flex-wrap gap-2">{(editingNode.notificationAdminEmails ?? []).map((email) => <span key={email} className="rounded-full bg-slate-100 px-2 py-1 text-xs">{email}</span>)}</div>
            </div>

            <div className="rounded border p-3">
              <p className="mb-2 text-sm font-medium">Template (assunto e corpo)</p>
              <input className="mb-2 w-full rounded border px-2 py-2" value={editingNode.kind === 'APPROVERS' ? editingNode.approvalTemplate?.subject ?? DEFAULT_TEMPLATE.subject : editingNode.notificationTemplate?.subject ?? DEFAULT_TEMPLATE.subject} onChange={(e) => updateNode(editingNode.id, (node) => node.kind === 'APPROVERS' ? { ...node, approvalTemplate: { subject: e.target.value, body: node.approvalTemplate?.body ?? DEFAULT_TEMPLATE.body } } : { ...node, notificationTemplate: { subject: e.target.value, body: node.notificationTemplate?.body ?? DEFAULT_TEMPLATE.body } })} />
              <textarea className="h-36 w-full rounded border px-2 py-2" value={editingNode.kind === 'APPROVERS' ? editingNode.approvalTemplate?.body ?? DEFAULT_TEMPLATE.body : editingNode.notificationTemplate?.body ?? DEFAULT_TEMPLATE.body} onChange={(e) => updateNode(editingNode.id, (node) => node.kind === 'APPROVERS' ? { ...node, approvalTemplate: { subject: node.approvalTemplate?.subject ?? DEFAULT_TEMPLATE.subject, body: e.target.value } } : { ...node, notificationTemplate: { subject: node.notificationTemplate?.subject ?? DEFAULT_TEMPLATE.subject, body: e.target.value } })} />
            </div>

            <div className="rounded bg-slate-50 p-3 text-xs text-slate-600">Placeholders disponíveis: {SOLICITATION_EMAIL_PLACEHOLDERS.join(', ')}</div>
          </div>
        </div>
      )}
    </div>
  )
}