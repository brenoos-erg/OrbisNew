'use client'

import * as React from 'react'
import { CargoFormModal, PositionRow } from './CargoFormModal'

export default function CargosPage() {
  const [rows, setRows] = React.useState<PositionRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<PositionRow | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/positions', { cache: 'no-store' })
      if (!r.ok) throw new Error('Falha ao carregar cargos.')
      const data: PositionRow[] = await r.json()
      setRows(data)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar cargos.')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    load()
  }, [])

  async function handleDelete(row: PositionRow) {
    if (!row.id) return
    if (!confirm(`Deseja realmente excluir o cargo "${row.name}"?`)) return
    const r = await fetch(`/api/positions/${row.id}`, { method: 'DELETE' })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      alert(err?.error || 'Falha ao excluir cargo.')
      return
    }
    load()
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-semibold text-slate-800">Cargos</h1>
      <p className="text-sm text-slate-500 mt-1">
        Cadastre e mantenha a tabela de cargos utilizada nas solicitações de pessoal.
      </p>

      <div className="mt-4 flex justify-between items-center">
        <div />
        <button
          onClick={() =>
            setEditing({
              name: '',
              description: '',
            })
          }
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-950"
        >
          Novo cargo
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white/70">
        {loading && (
          <div className="p-4 text-sm text-slate-500">
            Carregando cargos...
          </div>
        )}

        {error && (
          <div className="p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="p-4 text-sm text-slate-500">
            Nenhum cargo cadastrado.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-2 text-left">Cargo</th>
                <th className="px-4 py-2 text-left">Descrição</th>
                <th className="px-4 py-2 text-left">Local</th>
                <th className="px-4 py-2 text-left">Horário</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.description || '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.workLocation || '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.workHours || '—'}
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button
                      onClick={() => setEditing(r)}
                      className="text-xs rounded-md border px-2 py-1 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(r)}
                      className="text-xs rounded-md border px-2 py-1 text-red-600 hover:bg-red-50"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <CargoFormModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
