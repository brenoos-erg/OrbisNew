// src/app/dashboard/configuracoes/usuarios/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Save, Loader2, ArrowLeft, User as UserIcon } from 'lucide-react'

type UserView = {
  id: string
  fullName: string
  email: string
  login: string
  phone?: string | null
  costCenterId?: string | null
  costCenterName?: string | null
}

export default function PerfilDoUsuario() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [user, setUser] = useState<UserView | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setError(null); setOk(null)
      try {
        const r = await fetch(`/api/configuracoes/usuarios/${id}`, { cache: 'no-store' })
        if (!r.ok) throw new Error('Não foi possível carregar o usuário.')
        const data: UserView = await r.json()
        if (!alive) return
        setUser(data)
      } catch (e: any) {
        if (alive) setError(e?.message || 'Falha ao carregar.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true); setError(null); setOk(null)
    try {
      const r = await fetch(`/api/configuracoes/usuarios/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: user.fullName,
          email: user.email,
          login: user.login,
          phone: user.phone || '',
          costCenterId: user.costCenterId || null,
        }),
      })
      if (!r.ok) throw new Error('Falha ao salvar alterações.')
      setOk('Alterações salvas!')
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="max-w-7xl mx-auto p-6 text-sm text-slate-500">Carregando…</div>
  }
  if (!user) {
    return <div className="max-w-7xl mx-auto p-6 text-sm text-red-600">Usuário não encontrado.</div>
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-sm text-slate-500 mb-6">Sistema de Solicitações</div>

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-slate-900">Perfil do Usuário</h1>
        <button
          onClick={() => router.push('/dashboard/configuracoes/usuarios')}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">Visualize e edite os dados deste usuário.</p>

      {error && <div className="mb-4 rounded bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
      {ok && <div className="mb-4 rounded bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">{ok}</div>}

      <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ESQUERDA */}
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white/60 p-5">
            <div className="flex items-center gap-4">
              <div className="h-28 w-28 rounded-xl bg-slate-100 grid place-items-center overflow-hidden">
                <UserIcon className="h-8 w-8 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{user.fullName || '—'}</div>
                <div className="text-xs text-slate-500 truncate">{user.email || '—'}</div>
                <div className="text-xs text-slate-500 truncate">Login: {user.login || '—'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* DIREITA */}
        <div className="lg:col-span-8">
          <div className="rounded-xl border border-slate-200 bg-white/60 p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-black uppercase tracking-wide">Nome completo</label>
              <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                     value={user.fullName} onChange={e => setUser(v => v && ({ ...v, fullName: e.target.value }))}/>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-black uppercase tracking-wide">E-mail</label>
                <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                       value={user.email} onChange={e => setUser(v => v && ({ ...v, email: e.target.value }))}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-black uppercase tracking-wide">Login</label>
                <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                       value={user.login} onChange={e => setUser(v => v && ({ ...v, login: e.target.value }))}/>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-black uppercase tracking-wide">Telefone</label>
                <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                       value={user.phone || ''} onChange={e => setUser(v => v && ({ ...v, phone: e.target.value }))}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-black uppercase tracking-wide">Centro de Custo</label>
                <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                       value={user.costCenterName || ''} disabled/>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saving}
                      className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-950 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
