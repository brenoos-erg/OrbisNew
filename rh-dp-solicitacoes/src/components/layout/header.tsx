'use client'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function Header() {
  const router = useRouter()
  const supabase = supabaseBrowser()

  async function handleSignOut() {
    // 1) derruba sessão no cliente
    try { await supabase.auth.signOut({ scope: 'global' }) } catch {}

    // 2) derruba cookies no servidor (Next middleware depende disso)
    try { await fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' }) } catch {}

    // 3) navegação “à prova de cache”
    router.replace('/login')
    router.refresh()
    // 4) fallback bruto (se algo cachear mesmo assim)
    setTimeout(() => { window.location.href = '/login' }, 150)
  }

  return (
    <header className="flex items-center justify-between bg-slate-900 px-6 py-3 text-white">
      <h1 className="text-lg font-semibold">RH ⇆ DP — Sistema de Solicitações</h1>
      <button
        onClick={handleSignOut}
        className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium hover:bg-orange-600"
      >
        Sair
      </button>
    </header>
  )
}
