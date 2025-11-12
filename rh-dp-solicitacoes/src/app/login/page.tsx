'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { LogIn, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const search = useSearchParams()
  const nextUrl = search.get('next') || '/dashboard'
  const supabase = supabaseBrowser()

  const [loadingSession, setLoadingSession] = useState(true)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // --- Reset de senha (esqueci) ---
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [sendingReset, setSendingReset] = useState(false)
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const [resetErr, setResetErr] = useState<string | null>(null)

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

    const { data: { user } } = await supabase.auth.getUser()
    const must = (user?.user_metadata as any)?.mustChangePassword === true

    if (must) {
      router.replace(`/primeiro-acesso?next=${encodeURIComponent(nextUrl)}`)
    } else {
      router.replace(nextUrl)
    }
    router.refresh()
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setResetErr(null)
    setResetMsg(null)
    setSendingReset(true)
    try {
      const target = resetEmail.trim() || email.trim()
      if (!target) {
        setResetErr('Informe seu e-mail para enviar o link de recuperação.')
        setSendingReset(false)
        return
      }

      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${location.origin}/primeiro-acesso`,
      })
      if (error) throw error

      setResetMsg('Enviamos um link para o seu e-mail. Abra-o para definir uma nova senha.')
    } catch (err: any) {
      setResetErr(err?.message || 'Falha ao enviar e-mail de recuperação.')
    } finally {
      setSendingReset(false)
    }
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
            <div className="flex items-center justify-between">
              <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
              <button
                type="button"
                onClick={() => { setShowReset((v) => !v); setResetEmail(email); setResetMsg(null); setResetErr(null) }}
                className="text-xs text-orange-600 hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
            />
          </div>

          {showReset && (
            <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3">
              <div className="text-[13px] text-slate-700 mb-2">
                Enviaremos um link para redefinir sua senha. Ao abrir o link, você será levado à página de definição de nova senha.
              </div>
              <form onSubmit={handleReset} className="space-y-2">
                <input
                  type="email"
                  placeholder="seuemail@empresa.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                />
                {resetErr && <div className="text-[12px] text-red-600">{resetErr}</div>}
                {resetMsg && <div className="text-[12px] text-green-700">{resetMsg}</div>}
                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    disabled={sendingReset}
                    className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-950 disabled:opacity-60"
                  >
                    {sendingReset ? 'Enviando…' : 'Enviar link de recuperação'}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-xs hover:bg-slate-50"
                    onClick={() => { setShowReset(false); setResetErr(null); setResetMsg(null) }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

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
