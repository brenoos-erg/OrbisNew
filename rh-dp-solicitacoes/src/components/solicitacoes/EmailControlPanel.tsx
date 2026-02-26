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
  notificationTemplate?: { subject: string; body: string }
  approverUserIds?: string[]
  approvalTemplate?: { subject: string; body: string }
  departmentId?: string | null
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
type WorkflowUser = { id: string; fullName: string; email: string }

const DEFAULT_TEMPLATE = {
  subject: '[{tipoCodigo}] Nova etapa: {departamentoAtual}',
  body: 'Olá, o chamado {protocolo} ({tipoCodigo} - {tipoNome}) entrou na etapa {departamentoAtual}. Acesse: {link}',
}

function normalizeWorkflowGraph(workflow: RawApiWorkflow | ApiWorkflow): ApiWorkflow {
  const normalizedNodes: ApiNode[] = workflow.nodes.map((node, index) => ({
    ...node,
    kind: (node.kind === 'APPROVERS' ? 'APPROVERS' : 'DEPARTMENT') as NodeKind,
    posX: Number(node.posX ?? index * 240 + 40),
    posY: Number(node.posY ?? 80),
  }))

  return {
    ...workflow,
    nodes: normalizedNodes,
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

  const [newEmail, setNewEmail] = useState('')
  const [usersSearch, setUsersSearch] = useState('')
  const [users, setUsers] = useState<WorkflowUser[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      const response = await fetch('/api/solicitacoes/tipos', { cache: 'no-store' })
      const data: Tipo[] = await response.json()
      setTypes(data)
      if (data[0]?.id) setTypeId(data[0].id)
    })()
  }, [])

  useEffect(() => {
    if (!typeId) return
    ;(async () => {
      const response = await fetch(`/api/solicitacoes/workflows?typeId=${encodeURIComponent(typeId)}`, { cache: 'no-store' })
      const data: RawApiWorkflow = await response.json()
      const normalized = normalizeWorkflowGraph(data)
      setWorkflowId(normalized.workflowId)
      setNodes(normalized.nodes)
      setEdges(normalized.edges)
    })()
  }, [typeId])

  useEffect(() => {
    ;(async () => {
      const response = await fetch(`/api/solicitacoes/workflows/users?search=${encodeURIComponent(usersSearch)}`, { cache: 'no-store' })
      if (!response.ok) return
      const data: WorkflowUser[] = await response.json()
      setUsers(data)
    })()
  }, [usersSearch])

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

    for (const node of nodes) {
      if (!visited.has(node.id)) ordered.push(node)
    }

    return ordered
  }, [nodes, edges])

  const editingNode = nodes.find((node) => node.id === editingNodeId) ?? null

  const updateNode = (id: string, updater: (node: ApiNode) => ApiNode) => {
    setNodes((prev) => prev.map((node) => (node.id === id ? updater(node) : node)))
  }

  const onSave = async () => {
    setSaving(true)
    const payload = normalizeWorkflowGraph({ workflowId, nodes, edges })
    const response = await fetch('/api/solicitacoes/workflows', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ typeId, nodes: payload.nodes, edges: payload.edges }),
    })

    setSaving(false)
    if (!response.ok) {
      alert('Erro ao salvar configurações de e-mail.')
      return
    }

    alert('Configurações salvas com sucesso!')
  }

  const addEmail = () => {
    if (!editingNode || !newEmail.trim()) return
    const email = newEmail.trim()
    updateNode(editingNode.id, (node) => ({
      ...node,
      notificationEmails: Array.from(new Set([...(node.notificationEmails ?? []), email])),
    }))
    setNewEmail('')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <label className="text-sm font-medium">Tipo de Solicitação</label>
        <select className="mt-2 w-full rounded border px-3 py-2" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          {types.map((tipo) => (
            <option key={tipo.id} value={tipo.id}>
              {tipo.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Etapas do workflow</h2>
        <div className="space-y-2">
          {orderedNodes.map((node) => (
            <div key={node.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="text-xs text-slate-500">{node.kind}</p>
                <p className="font-medium">{node.label}</p>
                {node.kind === 'DEPARTMENT' ? (
                  <p className="text-xs text-slate-600">Destinatários automáticos: membros do departamento vinculado à etapa.</p>
                ) : (
                  <p className="text-xs text-slate-600">Destinatários automáticos: aprovadores selecionados nesta etapa.</p>
                )}
              </div>
              <button
                type="button"
                disabled={!canEdit}
                className="rounded border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setEditingNodeId(node.id)}
              >
                Editar e-mails
              </button>
            </div>
          ))}
        </div>
      </div>

      {!canEdit && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Sem permissão para editar templates e destinatários.</div>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={!canEdit || saving}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

      {editingNode && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500">{editingNode.kind}</p>
                <h2 className="text-lg font-semibold">Configurar etapa: {editingNode.label}</h2>
              </div>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => setEditingNodeId(null)}>
                Fechar
              </button>
            </div>

            {editingNode.kind === 'DEPARTMENT' && (
              <div className="space-y-4">
                <div className="rounded border bg-slate-50 p-3 text-sm text-slate-700">
                  Destinatários automáticos: todos os usuários ativos vinculados ao departamento desta etapa.
                </div>
                <div className="rounded border p-3">
                  <p className="mb-2 text-sm font-medium">E-mails extras manuais</p>
                  <div className="mb-2 flex gap-2">
                    <input className="flex-1 rounded border px-3 py-2" value={newEmail} placeholder="email@empresa.com" onChange={(e) => setNewEmail(e.target.value)} />
                    <button className="rounded border px-3 py-2" onClick={addEmail}>
                      Adicionar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(editingNode.notificationEmails ?? []).map((email) => (
                      <span key={email} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs">
                        {email}
                        <button
                          className="text-red-600"
                          onClick={() =>
                            updateNode(editingNode.id, (node) => ({
                              ...node,
                              notificationEmails: (node.notificationEmails ?? []).filter((item) => item !== email),
                            }))
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded border p-3">
                  <p className="mb-2 text-sm font-medium">Template da etapa de departamento</p>
                  <input
                    className="mb-2 w-full rounded border px-3 py-2"
                    value={editingNode.notificationTemplate?.subject ?? DEFAULT_TEMPLATE.subject}
                    onChange={(e) =>
                      updateNode(editingNode.id, (node) => ({
                        ...node,
                        notificationTemplate: {
                          subject: e.target.value,
                          body: node.notificationTemplate?.body ?? DEFAULT_TEMPLATE.body,
                        },
                      }))
                    }
                  />
                  <textarea
                    className="h-36 w-full rounded border px-3 py-2"
                    value={editingNode.notificationTemplate?.body ?? DEFAULT_TEMPLATE.body}
                    onChange={(e) =>
                      updateNode(editingNode.id, (node) => ({
                        ...node,
                        notificationTemplate: {
                          subject: node.notificationTemplate?.subject ?? DEFAULT_TEMPLATE.subject,
                          body: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {editingNode.kind === 'APPROVERS' && (
              <div className="space-y-4">
                <div className="rounded border bg-slate-50 p-3 text-sm text-slate-700">Destinatários automáticos: aprovadores configurados para esta etapa.</div>
                <div className="rounded border p-3">
                  <p className="mb-2 text-sm font-medium">Usuários aprovadores</p>
                  <input
                    className="mb-2 w-full rounded border px-3 py-2"
                    placeholder="Buscar usuário por nome/email"
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                  />
                  <div className="max-h-52 overflow-y-auto rounded border">
                    {users.map((user) => {
                      const selected = (editingNode.approverUserIds ?? []).includes(user.id)
                      return (
                        <label key={user.id} className="flex cursor-pointer items-center justify-between border-b px-3 py-2 text-sm last:border-b-0">
                          <span>
                            {user.fullName} <span className="text-slate-500">({user.email})</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(e) =>
                              updateNode(editingNode.id, (node) => ({
                                ...node,
                                approverUserIds: e.target.checked
                                  ? Array.from(new Set([...(node.approverUserIds ?? []), user.id]))
                                  : (node.approverUserIds ?? []).filter((id) => id !== user.id),
                              }))
                            }
                          />
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded border p-3">
                  <p className="mb-2 text-sm font-medium">Template de aprovação pendente</p>
                  <input
                    className="mb-2 w-full rounded border px-3 py-2"
                    value={editingNode.approvalTemplate?.subject ?? DEFAULT_TEMPLATE.subject}
                    onChange={(e) =>
                      updateNode(editingNode.id, (node) => ({
                        ...node,
                        approvalTemplate: {
                          subject: e.target.value,
                          body: node.approvalTemplate?.body ?? DEFAULT_TEMPLATE.body,
                        },
                      }))
                    }
                  />
                  <textarea
                    className="h-36 w-full rounded border px-3 py-2"
                    value={editingNode.approvalTemplate?.body ?? DEFAULT_TEMPLATE.body}
                    onChange={(e) =>
                      updateNode(editingNode.id, (node) => ({
                        ...node,
                        approvalTemplate: {
                          subject: node.approvalTemplate?.subject ?? DEFAULT_TEMPLATE.subject,
                          body: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="mt-4 rounded bg-slate-50 p-3 text-xs text-slate-600">Placeholders disponíveis: {SOLICITATION_EMAIL_PLACEHOLDERS.join(', ')}</div>
          </div>
        </div>
      )}
    </div>
  )
}