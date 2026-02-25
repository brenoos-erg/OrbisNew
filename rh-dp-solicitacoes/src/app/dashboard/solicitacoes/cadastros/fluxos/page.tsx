'use client'

import { useEffect, useMemo, useState } from 'react'

type NodeKind = 'DEPARTMENT' | 'APPROVERS' | 'END'

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
}

type ApiWorkflow = {
  workflowId: string
  nodes: ApiNode[]

  edges: Array<{ id: string; source: string; target: string }>
}

type Tipo = { id: string; name: string }
type WorkflowUser = { id: string; fullName: string; email: string }

const DEFAULT_TEMPLATE = {
  subject: '[{tipoCodigo}] Nova etapa: {departamentoAtual}',
  body: 'Olá, o chamado {protocolo} ({tipoCodigo} - {tipoNome}) entrou na etapa {departamentoAtual}. Acesse: {link}',
}

const PLACEHOLDERS = ['{protocolo}', '{tipoCodigo}', '{tipoNome}', '{solicitante}', '{departamentoAtual}', '{link}']

export default function FluxosSolicitacoesCadastroPage() {
  const [typeId, setTypeId] = useState('')
  const [types, setTypes] = useState<Tipo[]>([])
  const [workflowId, setWorkflowId] = useState('')
  const [nodes, setNodes] = useState<ApiNode[]>([])
  const [edges, setEdges] = useState<ApiWorkflow['edges']>([])
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  const [newEmail, setNewEmail] = useState('')
  const [usersSearch, setUsersSearch] = useState('')
  const [users, setUsers] = useState<WorkflowUser[]>([])

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
      const data: ApiWorkflow = await response.json()
      setWorkflowId(data.workflowId)
      setNodes(data.nodes)
      setEdges(data.edges)
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

  const edgesBySource = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const edge of edges) {
      map.set(edge.source, [...(map.get(edge.source) ?? []), edge.target])
    }
    return map
  }, [edges])

  const onSave = async () => {
   const payload = { typeId, nodes, edges }

    const response = await fetch('/api/solicitacoes/workflows', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      alert('Erro ao salvar workflow.')
      return
    }

    alert('Workflow salvo com sucesso!')
  }

  const editingNode = nodes.find((node) => node.id === editingNodeId) ?? null

  const updateNode = (id: string, updater: (node: ApiNode) => ApiNode) => {
    setNodes((prev) => prev.map((node) => (node.id === id ? updater(node) : node)))
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

  const removeEmail = (email: string) => {
    if (!editingNode) return
    updateNode(editingNode.id, (node) => ({
      ...node,
      notificationEmails: (node.notificationEmails ?? []).filter((item) => item !== email),
    }))
  }


  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Fluxo de Solicitações</h1>
        <select className="rounded border px-2 py-1" value={typeId} onChange={(event) => setTypeId(event.target.value)}>
          {types.map((tipo) => (
            <option key={tipo.id} value={tipo.id}>
              {tipo.name}
            </option>
          ))}
        </select>
        <button className="rounded border px-3 py-1" onClick={onSave} disabled={!typeId || nodes.length === 0}>
          Salvar
        </button>
      </div>

      <p className="text-xs text-slate-500">Workflow: {workflowId || '-'}</p>

      <div className="rounded border bg-slate-50 p-4">
        <p className="mb-3 text-sm font-medium">Visualização do fluxo (clique no bloco para editar notificações)</p>
        <div className="flex flex-wrap items-center gap-2">
          {nodes.map((node) => (
            <div key={node.id} className="flex items-center gap-2">
              <button
                type="button"
                className="min-w-44 rounded border bg-white px-3 py-2 text-left hover:border-blue-400"
                onClick={() => setEditingNodeId(node.id)}
              >
                <div className="text-xs text-slate-500">{node.kind}</div>
                <div className="font-medium">{node.label}</div>
                {node.kind !== 'END' && (
                  <div className="mt-1 text-xs text-slate-500">
                    {(node.notificationEmails ?? []).length} e-mails • {(node.approverUserIds ?? []).length} aprovadores
                  </div>
                )}
              </button>
               {(edgesBySource.get(node.id) ?? []).length > 0 ? <span className="text-slate-500">→</span> : null}
            </div>
          ))}
        </div>
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
                <div className="rounded border p-3">
                  <p className="mb-2 text-sm font-medium">E-mails notificados ao entrar na etapa</p>
                  <div className="mb-2 flex gap-2">
                    <input
                      className="flex-1 rounded border px-3 py-2"
                      value={newEmail}
                      placeholder="email@empresa.com"
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                    <button className="rounded border px-3 py-2" onClick={addEmail}>
                      Adicionar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(editingNode.notificationEmails ?? []).map((email) => (
                      <span key={email} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs">
                        {email}
                        <button className="text-red-600" onClick={() => removeEmail(email)}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded border p-3">
                  <p className="mb-2 text-sm font-medium">Template de notificação</p>
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
                <div className="rounded border p-3">
                  <p className="mb-2 text-sm font-medium">Usuários aprovadores (multi-select)</p>
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
                  <p className="mb-2 text-sm font-medium">Template de aprovação</p>
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

            <div className="mt-4 rounded bg-slate-50 p-3 text-xs text-slate-600">
              Placeholders disponíveis: {PLACEHOLDERS.join(', ')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}