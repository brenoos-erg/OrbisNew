'use client'

import { useEffect, useState } from 'react'
import UserCostCenterPanel from '../UserCostCenterPanel'

type UserStatus = 'ATIVO' | 'INATIVO'

type UserData = {
  id: string
  email: string
  fullName: string
  login: string | null
  phone: string | null
  status: UserStatus
}

const INPUT =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300'

type Props = {
  userId: string
  initialData?: UserData | null
}

export default function UserProfilePageClient({ userId, initialData }: Props) {
  const [user, setUser] = useState<UserData | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [saving, setSaving] = useState(false)

  // estados do formulário
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [login, setLogin] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<UserStatus>('ATIVO')

  // quando `user` mudar, atualiza campos do formulário
  useEffect(() => {
    if (!user) return
    setFullName(user.fullName ?? '')
    setEmail(user.email ?? '')
    setLogin(user.login ?? '')
    setPhone(user.phone ?? '')
    setStatus(user.status ?? 'ATIVO')
  }, [user])

  // se não veio `initialData` do servidor, carrega via fetch
  useEffect(() => {
    if (initialData) return

    ;(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/users/${userId}`, { cache: 'no-store' })
        if (!r.ok) {
          setUser(null)
          return
        }
        const data = await r.json()
        setUser(data)
      } catch (err) {
        console.error('Erro ao carregar usuário', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [userId, initialData])

  async function save() {
    if (!user) return
    setSaving(true)
    try {
      const r = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, login, phone, status }),
      })

      if (!r.ok) {
        const err = await r.json().catch(() => null)
        alert(err?.error || 'Falha ao salvar alterações.')
        return
      }

      alert('Alterações salvas.')

      // opcional: atualiza estado local após salvar
      setUser((prev) =>
        prev
          ? {
              ...prev,
              fullName,
              login: login || null,
              phone: phone || null,
              status,
            }
          : prev,
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6">Carregando…</div>
  if (!user) return <div className="p-6">Usuário não encontrado.</div>

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="text-sm text-slate-500">Sistema de Solicitações</div>
      <h1 className="text-xl font-semibold my-4">Perfil do Usuário</h1>

      <div className="grid grid-cols-12 gap-6">
        {/* Card à esquerda com avatar e status */}
        <div className="col-span-12 lg:col-span-4">
          <div className="border rounded-xl p-4 bg-white">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
                {user.email?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold">{user.fullName}</div>
                <div className="text-xs text-slate-500">Login: {user.login || '—'}</div>
                <div className="text-xs text-slate-500">E-mail: {user.email}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('ATIVO')}
                className={`px-3 py-2 rounded text-sm border ${
                  status === 'ATIVO'
                    ? 'bg-green-600 text-white border-green-700'
                    : 'hover:bg-slate-50'
                }`}
              >
                Ativo
              </button>
              <button
                type="button"
                onClick={() => setStatus('INATIVO')}
                className={`px-3 py-2 rounded text-sm border ${
                  status === 'INATIVO'
                    ? 'bg-red-600 text-white border-red-700'
                    : 'hover:bg-slate-50'
                }`}
              >
                Inativo
              </button>
            </div>
          </div>
        </div>

        {/* Formulário à direita */}
        <div className="col-span-12 lg:col-span-8">
          <div className="border rounded-xl p-4 bg-white">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase">
                  Nome completo
                </label>
                <input
                  className={INPUT}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">E-mail</label>
                <input className={INPUT} value={email} disabled />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">Login</label>
                <input
                  className={INPUT}
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">Telefone</label>
                <input
                  className={INPUT}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-950 disabled:opacity-50"
              >
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </div>

          {/* Painel de Centros de Custo do usuário */}
          <div className="mt-6">
            <UserCostCenterPanel userId={user.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
