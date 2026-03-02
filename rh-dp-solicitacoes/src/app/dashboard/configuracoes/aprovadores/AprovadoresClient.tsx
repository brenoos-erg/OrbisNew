'use client'

import { useEffect, useMemo, useState } from 'react'

type User = { id: string; fullName: string; email: string }
type Tipo = { id: string; codigo: string; nome: string; approvers: { userId: string; user: User }[] }

export default function AprovadoresClient() {
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [tipoId, setTipoId] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const currentTipo = useMemo(() => tipos.find((t) => t.id === tipoId) ?? null, [tipos, tipoId])

  const load = async () => {
    const res = await fetch('/api/config/aprovadores-por-tipo', { cache: 'no-store' })
    const json = await res.json()
    setTipos(json.tipos ?? [])
    setUsers(json.users ?? [])
    const first = tipoId || json.tipos?.[0]?.id || ''
    setTipoId(first)
  }

  useEffect(() => { void load() }, [])
  useEffect(() => {
    setSelected(currentTipo?.approvers?.map((a) => a.userId) ?? [])
  }, [currentTipo?.id])

  const save = async () => {
    await fetch('/api/config/aprovadores-por-tipo', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoId, userIds: selected }),
    })
    await load()
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-semibold">Aprovadores por tipo</h1>
      <select className="border rounded px-3 py-2" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
        {tipos.map((t) => <option key={t.id} value={t.id}>{t.codigo} - {t.nome}</option>)}
      </select>
      <div className="grid md:grid-cols-2 gap-2">
        {users.map((u) => (
          <label key={u.id} className="border rounded p-2 flex gap-2 items-center">
            <input
              type="checkbox"
              checked={selected.includes(u.id)}
              onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id))}
            />
            <span>{u.fullName} <span className="text-xs text-slate-500">({u.email})</span></span>
          </label>
        ))}
      </div>
      <button className="bg-orange-500 text-white rounded px-3 py-2" onClick={save}>Salvar</button>
    </div>
  )
}