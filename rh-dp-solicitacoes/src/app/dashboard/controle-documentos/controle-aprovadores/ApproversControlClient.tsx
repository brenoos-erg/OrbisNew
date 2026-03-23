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
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

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
    setSaving(true)
    await fetch('/api/documents/approvers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, canApproveTab2, canApproveTab3, active: true }),
    })

    setCanApproveTab2(true)
    setCanApproveTab3(false)
    await load()
    setFeedback('Aprovador incluído com sucesso.')
    setSaving(false)
  }

  const update = async (id: string, payload: Partial<Item>) => {
    setSaving(true)
    await fetch(`/api/documents/approvers/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await load()
    setFeedback('Configuração do aprovador atualizada.')
    setSaving(false)
  }

  const remove = async (id: string) => {
    setSaving(true)
    await fetch(`/api/documents/approvers/${id}`, { method: 'DELETE' })
    await load()
    setFeedback('Aprovador removido da lista.')
    setSaving(false)
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-orange-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Administração</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Controle de Aprovadores</h1>
        <p className="mt-1 text-sm text-slate-600">Defina os usuários responsáveis por aprovar documentos nas abas de aprovação e revisão da qualidade.</p>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[2fr,1fr,1fr,auto]">
        <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" value={userId} onChange={(e) => setUserId(e.target.value)}>
          {availableUsers.map((user) => (
            <option key={user.id} value={user.id}>{user.fullName} ({user.email})</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><input type="checkbox" checked={canApproveTab2} onChange={(e) => setCanApproveTab2(e.target.checked)} />Pode aprovar na aba 2</label>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><input type="checkbox" checked={canApproveTab3} onChange={(e) => setCanApproveTab3(e.target.checked)} />Pode aprovar na aba 3</label>
        <button className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50" onClick={create} disabled={!userId || availableUsers.length === 0 || saving}>{saving ? 'Salvando...' : 'Incluir'}</button>
      </div>
      {feedback ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{feedback}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="px-3 py-3 font-semibold">Usuário</th>
              <th className="px-3 py-3 font-semibold">Pode aprovar na aba 2</th>
              <th className="px-3 py-3 font-semibold">Pode aprovar na aba 3</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-800">{item.user.fullName}</p>
                  <p className="text-xs text-slate-500">{item.user.email}</p>
                </td>
                <td className="px-3 py-3"><input type="checkbox" checked={item.canApproveTab2} onChange={(e) => update(item.id, { canApproveTab2: e.target.checked })} /></td>
                <td className="px-3 py-3"><input type="checkbox" checked={item.canApproveTab3} onChange={(e) => update(item.id, { canApproveTab3: e.target.checked })} /></td>
                <td className="px-3 py-3">
                  <button className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`} onClick={() => update(item.id, { active: !item.active })}>
                    {item.active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-3 py-3">
                  <button className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => remove(item.id)}>Remover</button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr className="border-t">
                <td colSpan={5} className="px-3 py-8 text-center">
                  <p className="font-medium text-slate-700">Nenhum aprovador cadastrado</p>
                  <p className="mt-1 text-sm text-slate-500">Selecione um usuário acima para iniciar o controle de aprovações.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
