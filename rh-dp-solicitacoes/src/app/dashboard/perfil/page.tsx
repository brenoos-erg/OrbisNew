'use client'

import { useEffect, useState } from 'react'
import { fetchMe, type MePayload } from '@/lib/me-cache'

type PrismaMe = MePayload & {
  role?: 'COLABORADOR' | 'RH' | 'DP' | 'ADMIN'
}

export default function PerfilPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [me, setMe] = useState<PrismaMe>({})
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    fetchMe().then((p) => setMe((p as PrismaMe) || {})).catch((e) => setError(e?.message || 'Falha ao carregar perfil.')).finally(() => setLoading(false))
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setOk(null)
    const r = await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: me.fullName, phone: me.phone }) })
    const payload = await r.json().catch(() => ({}))
    if (!r.ok) {
      setSaving(false)
      return setError(payload?.error || 'Falha ao salvar perfil.')
    }
    if (newPassword) {
      const pr = await fetch('/api/me/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) })
      const pp = await pr.json().catch(() => ({}))
      if (!pr.ok) {
        setSaving(false)
        return setError(pp?.error || 'Falha ao atualizar senha.')
      }
      setCurrentPassword('')
      setNewPassword('')
    }
    setOk('Perfil atualizado com sucesso!')
    setSaving(false)
  }

  if (loading) return null

  return (
    <div className="max-w-3xl mx-auto">
      {error && <div className="mb-4 rounded bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
      {ok && <div className="mb-4 rounded bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">{ok}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded-md border px-3 py-2" value={me.fullName || ''} onChange={(e) => setMe((v) => ({ ...v, fullName: e.target.value }))} placeholder="Nome" />
        <input className="w-full rounded-md border px-3 py-2" value={me.phone || ''} onChange={(e) => setMe((v) => ({ ...v, phone: e.target.value }))} placeholder="Telefone" />
        <input className="w-full rounded-md border px-3 py-2" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Senha atual" type="password" />
        <input className="w-full rounded-md border px-3 py-2" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova senha" type="password" />
        <button disabled={saving} className="rounded-md bg-slate-900 text-white px-4 py-2">Salvar</button>
      </form>
    </div>
  )
}
