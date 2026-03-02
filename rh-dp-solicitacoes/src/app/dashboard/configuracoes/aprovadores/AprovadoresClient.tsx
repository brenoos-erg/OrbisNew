'use client'

import { useEffect, useMemo, useState } from 'react'

type User = { id: string; fullName: string; email: string }
type TipoApprover = { userId: string; role: 'APPROVER' | 'VIEWER'; user: User }
type Tipo = { id: string; codigo: string; nome: string; approvers: TipoApprover[] }

export default function AprovadoresClient() {
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [tipoId, setTipoId] = useState('')
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([])
  const [selectedViewers, setSelectedViewers] = useState<string[]>([])

  const currentTipo = useMemo(() => tipos.find((t) => t.id === tipoId) ?? null, [tipos, tipoId])

  const load = async () => {
    const res = await fetch('/api/config/aprovadores-por-tipo', { cache: 'no-store' })
    const json = await res.json()
    setTipos(json.tipos ?? [])
    setUsers(json.users ?? [])
    const first = tipoId || json.tipos?.[0]?.id || ''
    setTipoId(first)
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const entries = currentTipo?.approvers ?? []
    setSelectedApprovers(entries.filter((a) => a.role === 'APPROVER').map((a) => a.userId))
    setSelectedViewers(entries.filter((a) => a.role === 'VIEWER').map((a) => a.userId))
  }, [currentTipo?.id])

  const toggleRole = (role: 'APPROVER' | 'VIEWER', userId: string, checked: boolean) => {
    if (role === 'APPROVER') {
      setSelectedApprovers((prev) => (checked ? [...prev, userId] : prev.filter((id) => id !== userId)))
      if (checked) setSelectedViewers((prev) => prev.filter((id) => id !== userId))
      return
    }

    setSelectedViewers((prev) => (checked ? [...prev, userId] : prev.filter((id) => id !== userId)))
    if (checked) setSelectedApprovers((prev) => prev.filter((id) => id !== userId))
  }

  const save = async () => {
    await fetch('/api/config/aprovadores-por-tipo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoId, approvers: selectedApprovers, viewers: selectedViewers }),
    })
    await load()
  }

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-xl font-semibold">Aprovadores por tipo</h1>
      <select className="rounded border px-3 py-2" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
        {tipos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.codigo} - {t.nome}
          </option>
        ))}
      </select>

      <div className="rounded border bg-slate-50 p-3 text-sm text-slate-700">
        Defina por usuário se ele atua como <strong>Aprovador</strong> ou <strong>Visualizador (Nível 1)</strong>.
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {users.map((u) => {
          const isApprover = selectedApprovers.includes(u.id)
          const isViewer = selectedViewers.includes(u.id)
          return (
            <div key={u.id} className="space-y-2 rounded border p-3">
              <span>
                {u.fullName} <span className="text-xs text-slate-500">({u.email})</span>
              </span>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isApprover}
                    onChange={(e) => toggleRole('APPROVER', u.id, e.target.checked)}
                  />
                  Aprovador
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isViewer}
                    onChange={(e) => toggleRole('VIEWER', u.id, e.target.checked)}
                  />
                  Visualizador
                </label>
              </div>
              {(isApprover || isViewer) && (
                <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  {isApprover ? 'Aprovador' : 'Visualizador'}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <button className="rounded bg-orange-500 px-3 py-2 text-white" onClick={save}>
        Salvar
      </button>
    </div>
  )
}