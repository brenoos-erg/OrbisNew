'use client'

import { useEffect, useState } from 'react'

type User = { id: string; fullName: string | null; email: string }

export default function GestoresConfigClient() {
  const [users, setUsers] = useState<User[]>([])
  const [selected, setSelected] = useState<string[]>([])

  const load = async () => {
    const res = await fetch('/api/configuracoes/gestores', { cache: 'no-store' })
    const data = await res.json()
    setUsers(data.users ?? [])
    setSelected((data.members ?? []).map((item: { userId: string }) => item.userId))
  }

  useEffect(() => {
    void load()
  }, [])

  const save = async () => {
    await fetch('/api/configuracoes/gestores', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userIds: selected }),
    })
    await load()
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Configuração de Gestores</h1>
      <p className="mt-1 text-sm text-slate-600">Defina os gestores exibidos no campo de responsáveis do Plano de Ação Avulso.</p>
      <div className="mt-4 grid gap-2">
        {users.map((user) => (
          <label key={user.id} className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.includes(user.id)}
              onChange={(e) => {
                setSelected((prev) =>
                  e.target.checked ? [...prev, user.id] : prev.filter((id) => id !== user.id),
                )
              }}
            />
            {user.fullName || user.email}
          </label>
        ))}
      </div>
      <button onClick={save} className="mt-4 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Salvar gestores</button>
    </div>
  )
}