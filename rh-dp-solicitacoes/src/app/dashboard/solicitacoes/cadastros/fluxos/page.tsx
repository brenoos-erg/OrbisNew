'use client'

import { useEffect, useMemo, useState } from 'react'

type ApiWorkflow = {
  workflowId: string
  nodes: Array<{
    id: string
    label: string
    kind: 'DEPARTMENT' | 'APPROVERS' | 'END'
    posX: number
    posY: number
  }>
  edges: Array<{ id: string; source: string; target: string }>
}

type Tipo = { id: string; name: string }

export default function FluxosSolicitacoesCadastroPage() {
  const [typeId, setTypeId] = useState('')
  const [types, setTypes] = useState<Tipo[]>([])
  const [workflowId, setWorkflowId] = useState('')
  const [nodes, setNodes] = useState<ApiWorkflow['nodes']>([])
  const [edges, setEdges] = useState<ApiWorkflow['edges']>([])

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
      const response = await fetch(`/api/solicitacoes/workflows?typeId=${encodeURIComponent(typeId)}`, {
        cache: 'no-store',
      })
      const data: ApiWorkflow = await response.json()
      setWorkflowId(data.workflowId)
      setNodes(data.nodes)
      setEdges(data.edges)
    })()
  }, [typeId])

  const edgesBySource = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const edge of edges) {
      map.set(edge.source, [...(map.get(edge.source) ?? []), edge.target])
    }
    return map
  }, [edges])

  const onSave = async () => {
    const payload = {
      typeId,
      nodes,
      edges,
    }

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
        <p className="mb-3 text-sm font-medium">Visualização do fluxo</p>
        <div className="flex flex-wrap items-center gap-2">
          {nodes.map((node) => (
            <div key={node.id} className="flex items-center gap-2">
              <div className="min-w-44 rounded border bg-white px-3 py-2">
                <div className="text-xs text-slate-500">{node.kind}</div>
                <div className="font-medium">{node.label}</div>
              </div>
              {(edgesBySource.get(node.id) ?? []).length > 0 ? <span className="text-slate-500">→</span> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}