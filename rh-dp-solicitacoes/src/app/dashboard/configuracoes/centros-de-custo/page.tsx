'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Save, X, Download } from 'lucide-react'
import EditarCentroDeCusto, { type CostCenterRow } from './EditarCentroDeCusto'

type Row = CostCenterRow & { updatedAt: string }

const INPUT =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300'

export default function CostCentersPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // criação
  const [creating, setCreating] = useState(false)
  const [desc, setDesc] = useState('')
  const [code, setCode] = useState('')
  const [externalCode, setExternalCode] = useState('')
  const [abbreviation, setAbbreviation] = useState('')
  const [area, setArea] = useState('')
  const [managementType, setManagementType] = useState('')
  const [groupName, setGroupName] = useState('')
  const [status, setStatus] = useState<'ATIVADO' | 'INATIVO'>('ATIVADO')
  const [notes, setNotes] = useState('')

  // edição
  const [editing, setEditing] = useState<Row | null>(null)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  async function load() {
    setLoading(true)
    try {
      const skip = (page - 1) * pageSize
      const r = await fetch(
        `/api/cost-centers?q=${encodeURIComponent(q)}&take=${pageSize}&skip=${skip}`,
        { cache: 'no-store' },
      )
      const d = await r.json()
      setRows(
        (d.rows || []).map((r: any) => ({
          id: r.id,
          description: r.description,
          code: r.code,
          externalCode: r.externalCode,
          abbreviation: r.abbreviation,
          area: r.area,
          managementType: r.managementType,
          groupName: r.groupName,
          status: r.status,
          notes: r.notes,
          updatedAt: r.updatedAt,
        })),
      )
      setTotal(d.total || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page, pageSize])

  async function create() {
    if (!desc.trim()) return
    const r = await fetch('/api/cost-centers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: desc,
        code,
        externalCode,
        abbreviation,
        area,
        managementType,
        groupName,
        status,
        notes,
      }),
    })
    if (!r.ok) return alert('Falha ao criar')

    // limpar
    setDesc('')
    setCode('')
    setExternalCode('')
    setAbbreviation('')
    setArea('')
    setManagementType('')
    setGroupName('')
    setStatus('ATIVADO')
    setNotes('')
    setCreating(false)
    setPage(1)
    load()
  }

  function openEdit(row: Row) {
    setEditing(row)
  }

  async function remove(row: Row) {
    if (!confirm(`Excluir o centro de custo "${row.description}"?`)) return
    const r = await fetch(`/api/cost-centers/${row.id}`, { method: 'DELETE' })
    if (!r.ok) return alert('Falha ao excluir')
    load()
  }

  function exportCsv() {
    const header = ['Descrição', 'Código', 'Cód. Externo', 'Sigla', 'Status', 'Atualizado em']
    const body = rows.map((r) => [
      r.description,
      r.code || '',
      r.externalCode || '',
      r.abbreviation || '',
      r.status || '',
      new Date(r.updatedAt).toLocaleString('pt-BR'),
    ])
    const csv = [header, ...body]
      .map((line) => line.map((s) => `"${String(s).replaceAll('"', '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `centros-de-custo.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-sm text-slate-500 mb-6">Sistema de Solicitações</div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-slate-900">Centros de Custo</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
            title="Exportar CSV"
          >
            <Download size={16} /> Excel
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-950"
          >
            <Plus size={16} /> Novo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-slate-200 bg-white/60 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-black uppercase tracking-wide">
              Pesquisar
            </label>
            <input
              className={INPUT}
              placeholder="Descrição / código / sigla…"
              value={q}
              onChange={(e) => {
                setPage(1)
                setQ(e.target.value)
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-black uppercase tracking-wide">
              Linhas
            </label>
            <select
              className={INPUT}
              value={pageSize}
              onChange={(e) => {
                setPage(1)
                setPageSize(Number(e.target.value))
              }}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-slate-200 bg-white/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white sticky top-0">
              <tr className="text-left text-slate-500">
                <th className="py-2 px-4 w-[30%]">Descrição</th>
                <th className="py-2 px-4">Código</th>
                <th className="py-2 px-4">Cód. Externo</th>
                <th className="py-2 px-4">Sigla</th>
                <th className="py-2 px-4">Status</th>
                <th className="py-2 px-4">Atualizado em</th>
                <th className="py-2 px-4 w-[180px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-6 px-4 text-slate-500" colSpan={7}>
                    Carregando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="py-6 px-4 text-slate-500" colSpan={7}>
                    Nenhum centro de custo encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 px-4">{r.description}</td>
                    <td className="py-2 px-4">{r.code || '—'}</td>
                    <td className="py-2 px-4">{r.externalCode || '—'}</td>
                    <td className="py-2 px-4">{r.abbreviation || '—'}</td>
                    <td className="py-2 px-4">{r.status || '—'}</td>
                    <td className="py-2 px-4">{new Date(r.updatedAt).toLocaleString('pt-BR')}</td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-slate-50"
                        >
                          <Pencil size={16} /> Editar
                        </button>
                        <button
                          onClick={() => remove(r)}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-slate-50 text-red-600"
                        >
                          <Trash2 size={16} /> Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* paginação */}
        <div className="flex items-center justify-between p-3 border-t text-sm">
          <div className="text-slate-500">
            Exibindo {rows.length ? (page - 1) * pageSize + 1 : 0}–
            {Math.min(page * pageSize, total)} de {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span className="px-1">
              Página {page} / {totalPages}
            </span>
            <button
              className="rounded-md border px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Modal criar */}
      {creating && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Novo centro de custo</h3>
              <button onClick={() => setCreating(false)} className="rounded-md p-1 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase">Descrição *</label>
                <input className={INPUT} value={desc} onChange={(e) => setDesc(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase">Código</label>
                <input className={INPUT} value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">Código Externo</label>
                <input
                  className={INPUT}
                  value={externalCode}
                  onChange={(e) => setExternalCode(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">Sigla</label>
                <input
                  className={INPUT}
                  value={abbreviation}
                  onChange={(e) => setAbbreviation(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">Área</label>
                <input className={INPUT} value={area} onChange={(e) => setArea(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">Tipo de Gestão</label>
                <input
                  className={INPUT}
                  value={managementType}
                  onChange={(e) => setManagementType(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">Grupo</label>
                <input
                  className={INPUT}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">Status</label>
                <select
                  className={INPUT}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="ATIVADO">ATIVADO</option>
                  <option value="INATIVO">INATIVO</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase">Observações</label>
                <textarea
                  className={INPUT}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setCreating(false)}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm"
              >
                <X size={16} /> Cancelar
              </button>
              <button
                onClick={create}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-950"
              >
                <Save size={16} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <EditarCentroDeCusto
            row={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null)
              load()
            }}
          />
        </div>
      )}
    </div>
  )
}
