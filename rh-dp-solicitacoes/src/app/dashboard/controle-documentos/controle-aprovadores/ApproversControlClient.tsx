'use client'

import { useEffect, useMemo, useState } from 'react'

type User = { id: string; fullName: string; email: string }
type Item = {
  id: string
  userId: string
  canApproveTab2: boolean
  canApproveTab3: boolean
  active: boolean
  user: User
}

export default function ApproversControlClient() {
  const [items, setItems] = useState<Item[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [userId, setUserId] = useState('')
  const [canApproveTab2, setCanApproveTab2] = useState(true)
  const [canApproveTab3, setCanApproveTab3] = useState(false)

  const load = async () => {
    const res = await fetch('/api/documents/approvers', { cache: 'no-store' })
    const data = await res.json()
    setItems(data.items ?? [])
    setUsers(data.users ?? [])
    setUserId((current) => current || data.users?.[0]?.id || '')
  }

  useEffect(() => {
    void load()
  }, [])

  const alreadyLinked = useMemo(() => new Set(items.map((item) => item.userId)), [items])
  const availableUsers = useMemo(() => users.filter((user) => !alreadyLinked.has(user.id)), [users, alreadyLinked])

  const create = async () => {
    if (!userId) return

    await fetch('/api/documents/approvers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, canApproveTab2, canApproveTab3, active: true }),
    })

    setCanApproveTab2(true)
    setCanApproveTab3(false)
    await load()
  }

  const update = async (id: string, payload: Partial<Item>) => {
    await fetch(`/api/documents/approvers/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await load()
  }

  const remove = async (id: string) => {
    await fetch(`/api/documents/approvers/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <h1 className="text-xl font-semibold">Controle de Aprovadores</h1>

      <div className="grid gap-3 rounded border p-3 md:grid-cols-[2fr,1fr,1fr,auto]">
        <select className="rounded border px-3 py-2" value={userId} onChange={(e) => setUserId(e.target.value)}>
          {availableUsers.map((user) => (
            <option key={user.id} value={user.id}>{user.fullName} ({user.email})</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={canApproveTab2} onChange={(e) => setCanApproveTab2(e.target.checked)} />Pode aprovar na aba 2</label>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={canApproveTab3} onChange={(e) => setCanApproveTab3(e.target.checked)} />Pode aprovar na aba 3</label>
        <button className="rounded bg-orange-500 px-3 py-2 text-white" onClick={create} disabled={!userId || availableUsers.length === 0}>Incluir</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="px-2 py-2">Usuário</th>
              <th className="px-2 py-2">Pode aprovar na aba 2</th>
              <th className="px-2 py-2">Pode aprovar na aba 3</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-2 py-2">{item.user.fullName}</td>
                <td className="px-2 py-2"><input type="checkbox" checked={item.canApproveTab2} onChange={(e) => update(item.id, { canApproveTab2: e.target.checked })} /></td>
                <td className="px-2 py-2"><input type="checkbox" checked={item.canApproveTab3} onChange={(e) => update(item.id, { canApproveTab3: e.target.checked })} /></td>
                <td className="px-2 py-2">
                  <button className={`rounded px-2 py-1 text-xs ${item.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`} onClick={() => update(item.id, { active: !item.active })}>
                    {item.active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-2 py-2">
                  <button className="rounded border px-2 py-1" onClick={() => remove(item.id)}>Remover</button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr className="border-t">
                <td colSpan={5} className="px-2 py-3 text-slate-500">Nenhum aprovador cadastrado.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}