// src/app/dashboard/configuracoes/centros-de-custo/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Save, X, Download } from 'lucide-react'
import EditarCentroDeCusto, { type CostCenterRow } from './EditarCentroDeCusto'

type Row = CostCenterRow & { updatedAt: string }

// input “neutro” que se adapta ao tema pelo CSS
const INPUT =
  'mt-1 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground)] px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300 shadow-sm transition-colors'

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
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [notes, setNotes] = useState('')

  // edição
  const [editing, setEditing] = useState<Row | null>(null)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  )

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        q,
        page: String(page),
        pageSize: String(pageSize),
      })

      const r = await fetch(`/api/cost-centers?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!r.ok) throw new Error(`GET /api/cost-centers -> ${r.status}`)
      const { items, total } = await r.json()

      setRows(items)
      setTotal(total)
    } catch (err) {
      console.error(err)
      setRows([])
      setTotal(0)
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
    setStatus('ACTIVE')
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
    const header = [
      'Descrição',
      'Código',
      'Cód. Externo',
      'Sigla',
      'Status',
      'Atualizado em',
    ]
    const body = rows.map((r) => [
      r.description,
      r.code || '',
      r.externalCode || '',
      r.abbreviation || '',
      r.status || '',
      new Date(r.updatedAt).toLocaleString('pt-BR'),
    ])
    const csv = [header, ...body]
      .map((line) =>
        line.map((s) => `"${String(s).replaceAll('"', '""')}"`).join(';'),
      )
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
      <div className="text-sm text-slate-400 mb-6">Sistema de Solicitações</div>

      <div className="flex items-center justify-between mb-2">
        {/* AQUI: título mais escuro */}
        <h1 className="text-2xl font-semibold text-slate-900">
          Centros de Custo
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-white/5"
            title="Exportar CSV"
          >
            <Download size={16} /> Excel
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus size={16} /> Novo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="form-label">
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
            <label className="form-label">
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
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-header sticky top-0">
              <tr className="text-left text-slate-400">
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
                  <td
                    className="py-6 px-4 text-slate-500"
                    colSpan={7}
                  >
                    Carregando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    className="py-6 px-4 text-slate-500"
                    colSpan={7}
                  >
                    Nenhum centro de custo encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="table-row hover:bg-white/5"
                  >
                    <td className="py-2 px-4">{r.description}</td>
                    <td className="py-2 px-4">{r.code || '—'}</td>
                    <td className="py-2 px-4">
                      {r.externalCode || '—'}
                    </td>
                    <td className="py-2 px-4">
                      {r.abbreviation || '—'}
                    </td>
                    <td className="py-2 px-4">
                      {r.status || '—'}
                    </td>
                    <td className="py-2 px-4">
                      {new Date(r.updatedAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          className="btn-table"
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <button
                          onClick={() => remove(r)}
                          className="btn-table btn-table-danger"
                        >
                          <Trash2 size={14} /> Excluir
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
        <div className="table-footer flex items-center justify-between p-3 text-sm">
          <div className="text-slate-400">
            Exibindo {rows.length ? (page - 1) * pageSize + 1 : 0}–
            {Math.min(page * pageSize, total)} de {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-table px-3 py-1 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span className="px-1">
              Página {page} / {totalPages}
            </span>
            <button
              className="btn-table px-3 py-1 disabled:opacity-50"
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
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--card)] text-[var(--foreground)] p-6 shadow-xl border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Novo centro de custo
              </h3>
              <button
                onClick={() => setCreating(false)}
                className="rounded-md p-1 hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase">
                  Descrição *
                </label>
                <input
                  className={INPUT}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase">
                  Código
                </label>
                <input
                  className={INPUT}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">
                  Código Externo
                </label>
                <input
                  className={INPUT}
                  value={externalCode}
                  onChange={(e) => setExternalCode(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">
                  Sigla
                </label>
                <input
                  className={INPUT}
                  value={abbreviation}
                  onChange={(e) =>
                    setAbbreviation(e.target.value)
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">
                  Área
                </label>
                <input
                  className={INPUT}
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">
                  Tipo de Gestão
                </label>
                <input
                  className={INPUT}
                  value={managementType}
                  onChange={(e) =>
                    setManagementType(e.target.value)
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">
                  Grupo
                </label>
                <input
                  className={INPUT}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">
                  Status
                </label>
                <select
                  className={INPUT}
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as any)
                  }
                >
                  <option value="ACTIVE">ATIVO</option>
                  <option value="INACTIVE">INATIVO</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase">
                  Observações
                </label>
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
                className="btn-table px-4 py-2"
              >
                <X size={16} /> Cancelar
              </button>
              <button
                onClick={create}
                className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
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
