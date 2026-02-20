'use client'

import { useEffect, useState } from 'react'

type FlowItem = { order: number; stepType: string; approverGroupId: string; active: boolean }
type DocType = {
  id: string
  code: string
  description: string
  controlledCopy: boolean
  linkCostCenterArea: boolean
  approvalFlowItems: FlowItem[]
}

type Group = { id: string; name: string }

const defaultDraft = {
  code: '',
  description: '',
  controlledCopy: false,
  linkCostCenterArea: false,
  approvalFlowItems: [{ order: 1, stepType: 'SIG', approverGroupId: '', active: true }],
}

export default function TiposDocumentosPage() {
  const [rows, setRows] = useState<DocType[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(defaultDraft)

  const load = async () => {
    const [typesRes, groupsRes] = await Promise.all([
      fetch('/api/document-types', { cache: 'no-store' }),
      fetch('/api/approver-groups', { cache: 'no-store' }),
    ])

    setRows(await typesRes.json())
    setGroups(await groupsRes.json())
  }

  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    const payload = { ...draft, approvalFlowItems: draft.approvalFlowItems.filter((item) => item.approverGroupId) }
    const method = editingId ? 'PUT' : 'POST'
    const url = editingId ? `/api/document-types/${editingId}` : '/api/document-types'
    await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    setEditingId(null)
    setDraft(defaultDraft)
    await load()
  }

  const startEdit = (row: DocType) => {
    setEditingId(row.id)
    setDraft({
      code: row.code,
      description: row.description,
      controlledCopy: row.controlledCopy,
      linkCostCenterArea: row.linkCostCenterArea,
      approvalFlowItems: row.approvalFlowItems.length ? row.approvalFlowItems : defaultDraft.approvalFlowItems,
    })
  }

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <h1 className="text-xl font-semibold">Tipos de Documento</h1>

      <div className="space-y-2 rounded border p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input className="rounded border px-3 py-2" placeholder="Código" value={draft.code} onChange={(e) => setDraft((v) => ({ ...v, code: e.target.value }))} />
          <input className="rounded border px-3 py-2" placeholder="Descrição" value={draft.description} onChange={(e) => setDraft((v) => ({ ...v, description: e.target.value }))} />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.controlledCopy} onChange={(e) => setDraft((v) => ({ ...v, controlledCopy: e.target.checked }))} />Cópia Controlada</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.linkCostCenterArea} onChange={(e) => setDraft((v) => ({ ...v, linkCostCenterArea: e.target.checked }))} />Associa ao Centro de Custo</label>
        </div>

        <div className="space-y-2">
          <h2 className="font-semibold">Fluxo de aprovação por grupo (aprovação final SIG)</h2>
          {draft.approvalFlowItems.map((item, idx) => (
            <div key={`${idx}-${item.order}`} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-4">
              <input className="rounded border px-2 py-1" type="number" value={item.order} onChange={(e) => setDraft((v) => ({ ...v, approvalFlowItems: v.approvalFlowItems.map((f, i) => i === idx ? { ...f, order: Number(e.target.value) } : f) }))} />
              <select className="rounded border px-2 py-1" value={item.stepType} onChange={(e) => setDraft((v) => ({ ...v, approvalFlowItems: v.approvalFlowItems.map((f, i) => i === idx ? { ...f, stepType: e.target.value } : f) }))}>
                <option value="REVIEW">REVIEW</option>
                <option value="QUALITY">QUALITY</option>
                <option value="SIG">SIG</option>
                <option value="APPROVAL_GENERIC">APPROVAL_GENERIC</option>
              </select>
              <select className="rounded border px-2 py-1" value={item.approverGroupId} onChange={(e) => setDraft((v) => ({ ...v, approvalFlowItems: v.approvalFlowItems.map((f, i) => i === idx ? { ...f, approverGroupId: e.target.value } : f) }))}>
                <option value="">Grupo aprovador</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <button className="rounded border px-3 py-1" onClick={() => setDraft((v) => ({ ...v, approvalFlowItems: v.approvalFlowItems.filter((_, i) => i !== idx) }))}>Remover</button>
            </div>
          ))}
          <button className="rounded border px-3 py-1" onClick={() => setDraft((v) => ({ ...v, approvalFlowItems: [...v.approvalFlowItems, { order: v.approvalFlowItems.length + 1, stepType: 'SIG', approverGroupId: '', active: true }] }))}>Adicionar etapa</button>
        </div>

        <div className="flex gap-2">
          <button className="rounded bg-blue-700 px-3 py-2 text-white" onClick={save}>{editingId ? 'Salvar alterações' : 'Criar tipo'}</button>
          {editingId ? <button className="rounded border px-3 py-2" onClick={() => { setEditingId(null); setDraft(defaultDraft) }}>Cancelar</button> : null}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead><tr><th>Código</th><th>Descrição</th><th>Cópia Controlada?</th><th>Associa Área CC?</th><th>Fluxo</th><th /></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t" key={row.id}>
              <td>{row.code}</td>
              <td>{row.description}</td>
              <td>{row.controlledCopy ? 'Sim' : 'Não'}</td>
              <td>{row.linkCostCenterArea ? 'Sim' : 'Não'}</td>
              <td>{row.approvalFlowItems.map((item) => `${item.order}-${item.stepType}`).join(', ') || '-'}</td>
              <td><button className="rounded border px-2 py-1" onClick={() => startEdit(row)}>Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}