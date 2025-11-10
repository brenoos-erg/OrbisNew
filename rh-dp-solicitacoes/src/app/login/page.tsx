'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { LogIn, Loader2 } from 'lucide-react'   // <- IMPORT DOS ÍCONES

export default function LoginPage() {
  const router = useRouter()
  const search = useSearchParams()
  const nextUrl = search.get('next') || '/dashboard'
  const supabase = supabaseBrowser()

  const [loadingSession, setLoadingSession] = useState(true)
  const [loading, setLoading] = useState(false)   // <- ESTADO QUE FALTAVA
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    // derruba a sessão ao abrir /login (forçar login)
    ;(async () => {
      try { await supabase.auth.signOut({ scope: 'global' }) } catch {}
      try { await fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' }) } catch {}
      setLoadingSession(false)
    })()
  }, []) // eslint-disable-line

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      alert(error.message)
      return
    }

    // sincroniza sessão/usuário no backend
    try { await fetch('/api/session/sync', { method: 'POST', cache: 'no-store' }) } catch {}

    router.replace(nextUrl)
    router.refresh()
    // setLoading(false) // opcional (a navegação normalmente desmonta o componente)
  }

  if (loadingSession) return null

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-3xl border-2 border-orange-300 bg-white p-10 shadow-[0_20px_60px_-20px_rgba(2,6,23,.25)]">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-orange-300 bg-orange-50">
            <LogIn className="h-6 w-6 text-orange-500" />
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Canal de Solicitações</h1>
          <p className="text-xs text-slate-500">RH ↔ DP</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              placeholder="seuemail@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-orange-300"
            style={{ boxShadow: '0 0 0 2px rgba(251,146,60,.4) inset' }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {loading ? 'Entrando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}
