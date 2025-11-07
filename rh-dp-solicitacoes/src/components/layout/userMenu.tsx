'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js' // se você já tem um client pronto, troque por '@/lib/supabase/client'
import { ChevronDown, LogOut, Settings as SettingsIcon } from 'lucide-react'

type Props = {
  collapsed?: boolean
}

// ▶️ use o seu client já existente, se preferir
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? ''
  const b = parts[parts.length - 1]?.[0] ?? ''
  return (a + b).toUpperCase()
}

export default function UserMenu({ collapsed }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState<string>('')
  const [login, setLogin] = useState<string>('')
  const [email, setEmail] = useState<string>('')

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (mounted && user) {
        const meta = user.user_metadata || {}
        // Preferências: fullName → meta.fullName → email
        const name =
          meta.fullName?.toString()?.trim() ||
          user.email?.toString()?.trim() ||
          'Usuário'

        const handle =
          meta.login?.toString()?.trim() ||
          user.email?.split('@')[0] ||
          ''

        setFullName(name)
        setLogin(handle)
        setEmail(user.email || '')
      }
      setLoading(false)
    }
    load()

    // atualiza se a sessão mudar
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load()
    })
    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="relative">
      {/* Botão/área do usuário */}
      <button
        onClick={() => setOpen(v => !v)}
        className={[
          'w-full rounded-xl bg-white/5 hover:bg-white/10 text-left',
          'flex items-center gap-3 px-3 py-2 transition',
        ].join(' ')}
      >
        {/* Avatar com iniciais */}
        <div className="h-9 w-9 rounded-lg bg-white/15 grid place-items-center text-xs font-bold text-white">
          {loading ? '…' : initialsFrom(fullName)}
        </div>

        {/* Texto: some se o menu estiver colapsado */}
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm text-white">{loading ? 'Carregando…' : fullName}</div>
            <div className="truncate text-[11px] text-slate-400">{login || email}</div>
          </div>
        )}

        <ChevronDown className={['ml-auto text-slate-300', open ? 'rotate-180' : ''].join(' ')} size={16} />
      </button>

      {/* Dropdown – funciona colapsado e expandido */}
      {open && (
  <div
    className={[
      'absolute z-50 w-56 rounded-xl border border-white/10 bg-[#0f172a] text-slate-100 shadow-xl',
      // 👉 abre PRA CIMA
      'bottom-full mb-2 left-0',
      // quando colapsado, dá um leve deslocamento pra dentro
      collapsed ? 'translate-x-[8px]' : '',
    ].join(' ')}
  >
    <div className="px-3 py-2">
      <div className="text-sm font-medium truncate">{fullName}</div>
      <div className="text-[11px] text-slate-400 truncate">{email || login}</div>
    </div>

    <div className="my-2 h-px bg-white/10" />

    <button
      onClick={() => (window.location.href = '/dashboard/configuracoes/perfil')}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
    >
      <SettingsIcon size={16} />
      Gerenciar perfil
    </button>

    <button
      onClick={handleSignOut}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
    >
      <LogOut size={16} />
      Sair
    </button>
  </div>
      )}
    </div>
  )
}
