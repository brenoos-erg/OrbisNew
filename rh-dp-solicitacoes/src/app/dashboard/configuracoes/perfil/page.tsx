'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Save, Loader2, User as UserIcon, BadgeCheck, Image as ImageIcon } from 'lucide-react'

type PrismaMe = {
  id?: string
  fullName?: string
  email?: string
  login?: string
  phone?: string | null
  costCenter?: string | null
  role?: 'COLABORADOR' | 'RH' | 'DP' | 'ADMIN'
}

export default function PerfilPage() {
  const sb = supabaseBrowser()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  // Prisma
  const [me, setMe] = useState<PrismaMe>({})

  // Metadata Supabase
  const [avatarUrl, setAvatarUrl]   = useState('')
  const [position, setPosition]     = useState('') // cargo
  const [department, setDepartment] = useState('') // setor
  const [leaderName, setLeaderName] = useState('') // líder

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError(null)
      setOk(null)
      try {
        // 1) Prisma
        const r = await fetch('/api/me', { cache: 'no-store' })
        if (!r.ok) throw new Error('Não foi possível carregar seu perfil.')
        const p: PrismaMe = await r.json()
        if (!alive) return
        setMe(p)

        // 2) Supabase metadata
        const { data: { user } } = await sb.auth.getUser()
        const meta = (user?.user_metadata ?? {}) as Record<string, any>
        setAvatarUrl(meta.avatarUrl || '')
        setPosition(meta.position || '')
        setDepartment(meta.department || '')
        setLeaderName(meta.leaderName || '')
      } catch (e: any) {
        if (alive) setError(e?.message || 'Falha ao carregar perfil.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    setSaving(true)
    try {
      const r = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: me.fullName,
          phone: me.phone,
          costCenter: me.costCenter,
          avatarUrl,
          position,
          department,
          leaderName,
        }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error || `Falha ao atualizar (${r.status})`)
      }
      await sb.auth.refreshSession()
      setOk('Perfil atualizado com sucesso!')
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  // Upload de avatar → Storage bucket "avatars"
const AVATAR_BUCKET = 'avatars'

    async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const inputEl = e.currentTarget
    const file = inputEl.files?.[0]
    if (!file) return

    setError(null)
    setOk(null)

    try {
      // validações básicas (opcional)
      if (!file.type.startsWith('image/')) {
        throw new Error('Selecione uma imagem (JPG, PNG, WEBP, etc).')
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB
        throw new Error('Imagem muito grande. Máximo: 5 MB.')
      }

    const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Sessão expirada. Faça login novamente.')

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `user-${user.id}/${Date.now()}.${ext}`

     // 1) upload
      const up = await sb.storage.from(AVATAR_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      })
      if (up.error) throw up.error

    // 2) URL pública (se o bucket for público)
      const { data } = sb.storage.from(AVATAR_BUCKET).getPublicUrl(path)
      const publicUrl = data?.publicUrl
      if (!publicUrl) throw new Error('Não foi possível obter a URL do avatar.')

      // 3) atualiza preview
      setAvatarUrl(publicUrl)
      setOk('Foto enviada! Clique em "Salvar alterações" para aplicar.')

      // 4) (opcional) salva automaticamente no perfil
      //    — remova este bloco se quiser salvar apenas no botão
      setSaving(true)
      const r = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error || `Falha ao salvar avatar (${r.status})`)
      }
      setOk('Foto enviada e salva no perfil!')
    } catch (err: any) {
      setError(err?.message || 'Falha ao enviar a foto.')
    } finally {
      if (inputEl) inputEl.value = '' // permite escolher o mesmo arquivo depois
      setSaving(false)
    }
    
  }



  const roleLabel: Record<string, string> = {
    COLABORADOR: 'Colaborador',
    RH: 'Recursos Humanos',
    DP: 'Departamento Pessoal',
    ADMIN: 'Administrador',
  }

  if (loading) return null

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-sm text-slate-500 mb-6">Sistema de Solicitações</div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Meu Perfil</h1>
      <p className="text-sm text-slate-500 mb-6">Gerencie suas informações pessoais e de contato.</p>

      {error && <div className="mb-4 rounded bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
      {ok && (
        <div className="mb-4 rounded bg-emerald-50 text-emerald-700 px-3 py-2 text-sm flex items-center gap-2">
          <BadgeCheck className="h-4 w-4" /> {ok}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ESQUERDA */}
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white/60 p-5">
            <div className="flex items-center gap-4">
              <div className="h-28 w-28 rounded-xl bg-slate-100 grid place-items-center overflow-hidden">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-8 w-8 text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{me.fullName || '—'}</div>
                <div className="text-xs text-slate-500 truncate">{me.email || '—'}</div>
                <div className="text-xs text-slate-500 truncate">Login: {me.login || '—'}</div>
                <div className="text-xs text-slate-500 truncate">Perfil: {roleLabel[me.role || 'COLABORADOR']}</div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold text-black uppercase tracking-wide">Foto de Perfil</label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                  <ImageIcon className="h-4 w-4" />
                  Selecionar do computador
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                </label>
              </div>

              <label className="block text-xs font-semibold text-black uppercase tracking-wide mt-3">URL da foto (opcional)</label>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
                placeholder="https://…"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Você pode subir pelo botão acima (Storage) ou colar uma URL pública.
              </p>
            </div>
          </div>
        </div>

        {/* DIREITA */}
        <div className="lg:col-span-8">
          <div className="rounded-xl border border-slate-200 bg-white/60 p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-black uppercase tracking-wide">Nome completo</label>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
                value={me.fullName || ''}
                onChange={(e) => setMe(v => ({ ...v, fullName: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-black uppercase tracking-wide">Cargo</label>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
                  placeholder="Ex.: Analista de RH"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-black uppercase tracking-wide">Setor</label>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
                  placeholder="Ex.: TI"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-black uppercase tracking-wide">Líder</label>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
                placeholder="Nome do(a) líder imediato(a)"
                value={leaderName}
                onChange={(e) => setLeaderName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-black uppercase tracking-wide">Telefone</label>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
                  placeholder="(31) 99999-0000"
                  value={me.phone || ''}
                  onChange={(e) => setMe(v => ({ ...v, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-black uppercase tracking-wide">Centro de Custo</label>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
                  placeholder="Ex.: TI"
                  value={me.costCenter || ''}
                  onChange={(e) => setMe(v => ({ ...v, costCenter: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-950 disabled:opacity-60"
              >
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
