// src/components/layout/userMenu.tsx
'use client'

import { useEffect, useState } from 'react'
import { clearSessionMeCache, fetchSessionMe } from '@/lib/session-cache'
import { supabaseBrowser } from '@/lib/supabase/client'
import { ChevronDown, LogOut, Settings as SettingsIcon, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'

type Props = { collapsed?: boolean }

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? ''
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (a + b).toUpperCase() || '…'
}

export default function UserMenu({ collapsed }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [login, setLogin] = useState('')
  const [email, setEmail] = useState('')

  const { theme, toggleTheme } = useTheme()
  const supabase = supabaseBrowser()

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)

      // 1) Usuário autenticado no Supabase
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!mounted || !user) {
        setFullName('')
        setLogin('')
        setEmail('')
        setLoading(false)
        return
      }

      // 2) Tenta pegar o “espelho” oficial no Prisma via /api/session/me
      const payload = await fetchSessionMe().catch(() => null)
      const prismaUser: any = payload?.appUser ?? null
      const meta = (user.user_metadata || {}) as Record<string, any>

      const name =
        prismaUser?.fullName?.toString()?.trim() ||
        meta.fullName?.toString()?.trim() ||
        meta.name?.toString()?.trim() ||
        user.email?.toString()?.trim() ||
        'Usuário'

      const loginValue =
        prismaUser?.login?.toString()?.trim() ||
        meta.login?.toString()?.trim() ||
        user.email?.split('@')[0] ||
        ''

      const emailValue =
        prismaUser?.email?.toString()?.trim() || user.email?.toString()?.trim() || ''

      if (!mounted) return

      setFullName(name)
      setLogin(loginValue)
      setEmail(emailValue)
      setLoading(false)
    }

    load()

    // Recarrega se a sessão mudar
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSignOut() {
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } catch {}
    try {
      await fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' })
    } catch {}
    clearSessionMeCache()
    window.location.href = '/login'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl bg-white/5 hover:bg-white/10 text-left flex items-center gap-3 px-3 py-2 transition"
      >
        <div className="h-9 w-9 rounded-lg bg-white/15 grid place-items-center text-xs font-bold text-white">
          {loading ? '…' : initialsFrom(fullName)}
        </div>

        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm text-white">
              {loading ? 'Carregando…' : fullName || 'Usuário'}
            </div>
            <div className="truncate text-[11px] text-slate-400">{login || email}</div>
          </div>
        )}

        <ChevronDown
          className={['ml-auto text-slate-300', open ? 'rotate-180' : ''].join(' ')}
          size={16}
        />
      </button>

      {open && (
        <div
          className={[
            'absolute z-50 w-56 rounded-xl border border-white/10 bg-[#0f172a] text-slate-100 shadow-xl',
            'bottom-full mb-2 left-0',
            collapsed ? 'translate-x-[8px]' : '',
          ].join(' ')}
        >
          <div className="px-3 py-2">
            <div className="text-sm font-medium truncate">{fullName || 'Usuário'}</div>
            <div className="text-[11px] text-slate-400 truncate">{email || login}</div>
          </div>

          <div className="my-2 h-px bg-white/10" />

        

          <div className="my-2 h-px bg-white/10" />

          <button
            onClick={() => (window.location.href = '/dashboard/perfil')}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
          >
            <SettingsIcon size={16} /> Gerenciar perfil
          </button>

          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      )}
    </div>
  )
}
