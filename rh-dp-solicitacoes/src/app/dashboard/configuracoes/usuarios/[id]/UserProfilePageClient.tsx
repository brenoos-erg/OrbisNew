// src/app/dashboard/configuracoes/usuarios/[id]/UserProfilePageClient.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import UserCostCenterPanel from '../UserCostCenterPanel'

type User = {
  id: string
  fullName: string
  email: string
  login: string | null
  phone: string | null
  status: 'ATIVO' | 'INATIVO'
  costCenterId: string | null
}

const INPUT =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300'

export default function UserProfilePageClient({ userId }: { userId: string }) {
  const [u, setU] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // form state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [login, setLogin] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO')

  // avatar (Supabase Auth -> user_metadata.avatar_url)
  const [avatarUrl, setAvatarUrl] = useState('/avatar-placeholder.svg')

  // Carrega dados do usuário (sua API)
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/users/${userId}`, { cache: 'no-store' })
        const data = await r.json()
        setU(data)
        setFullName(data.fullName || '')
        setEmail(data.email || '')
        setLogin(data.login || '')
        setPhone(data.phone || '')
        setStatus((data.status as 'ATIVO' | 'INATIVO') || 'ATIVO')
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  // Carrega avatar da sessão do Supabase
  useEffect(() => {
    const supabase = createClientComponentClient()

    const loadAvatar = async () => {
      const { data } = await supabase.auth.getSession()
      const url = data?.session?.user?.user_metadata?.avatar_url as string | undefined
      setAvatarUrl(url && url.length > 0 ? url : '/avatar-placeholder.svg')
    }

    loadAvatar()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const url = session?.user?.user_metadata?.avatar_url as string | undefined
      setAvatarUrl(url && url.length > 0 ? url : '/avatar-placeholder.svg')
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  async function save() {
    setSaving(true)
    try {
      const r = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, login, phone, status }),
      })
      if (!r.ok) {
        alert('Falha ao salvar alterações.')
        return
      }
      alert('Alterações salvas.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6">Carregando…</div>
  if (!u) return <div className="p-6">Usuário não encontrado.</div>

  return (
    <div className="max-w-6xl">
      <div className="text-sm text-slate-500">Sistema de Solicitações</div>
      <h1 className="text-xl font-semibold my-4">Perfil do Usuário</h1>

      <div className="grid grid-cols-12 gap-6">
        {/* Card à esquerda com foto e status */}
        <div className="col-span-12 lg:col-span-4">
          <div className="border rounded-xl p-4 bg-white">
            <div className="flex items-center gap-4">
              <img
                src={avatarUrl}
                alt={u.fullName}
                className="h-20 w-20 rounded-full object-cover bg-slate-100 border border-slate-200"
              />
              <div>
                <div className="font-semibold">{u.fullName}</div>
                <div className="text-xs text-slate-500">Login: {u.login || '—'}</div>
                <div className="text-xs text-slate-500">E-mail: {u.email}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setStatus('ATIVO')}
                className={`px-3 py-2 rounded text-sm border ${
                  status === 'ATIVO' ? 'bg-green-600 text-white border-green-700' : 'hover:bg-slate-50'
                }`}
              >
                Ativo
              </button>
              <button
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
                <label className="block text-xs font-semibold uppercase">Nome completo</label>
                <input className={INPUT} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">E-mail</label>
                <input className={INPUT} value={email} disabled />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">Login</label>
                <input className={INPUT} value={login} onChange={(e) => setLogin(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase">Telefone</label>
                <input className={INPUT} value={phone} onChange={(e) => setPhone(e.target.value)} />
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
            <UserCostCenterPanel userId={u.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
