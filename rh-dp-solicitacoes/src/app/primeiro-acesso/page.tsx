// src/app/primeiro-acesso/page.tsx
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { KeyRound, Loader2 } from 'lucide-react'
export const dynamic = 'force-dynamic'


export default function PrimeiroAcessoPage() {
  return (
    <Suspense fallback={null}>
      <PrimeiroAcessoContent />
    </Suspense>
  )
}

function PrimeiroAcessoContent() {
  const router = useRouter()
  const search = useSearchParams()
  const nextUrl = search.get('next') || '/dashboard'
  const supabase = supabaseBrowser()

  const [checking, setChecking] = useState(true)
  const [pwd1, setPwd1] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // garante que existe sessão; se não, manda pro login
  useEffect(() => {
    let active = true
    ;(async () => {
      const code = search.get('code')
      const errorDescription = search.get('error_description')

      if (errorDescription && active) {
        setError(errorDescription)
        setChecking(false)
        return
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (!active) return
        if (exchangeError) {
          setError(exchangeError.message)
          setChecking(false)
          return
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent('/primeiro-acesso')}`)
        return
       }
      setChecking(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { active = false }
  }, [router, search, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (pwd1.length < 6) return setError('A nova senha deve ter ao menos 6 caracteres.')
    if (pwd1 !== pwd2)  return setError('As senhas não coincidem.')

    setSaving(true)

    // 1) atualiza a senha e limpa o flag no user_metadata
    const { error } = await supabase.auth.updateUser({
      password: pwd1,
      data: { mustChangePassword: false },
    })
    if (error) {
      setSaving(false)
      setError(error.message)
      return
    }

    // 2) REFRESH da sessão -> cookie novo sem o flag
    await supabase.auth.refreshSession()

    // 3) (opcional) sincroniza backend
    try { await fetch('/api/session/sync', { method: 'POST', cache: 'no-store' }) } catch {}

    setSaving(false)

    // 4) navega
    try {
      router.replace(nextUrl)
      router.refresh()
    } finally {
      // fallback hard pra garantir que o middleware leia o cookie novo
      setTimeout(() => { window.location.replace(nextUrl) }, 50)
    }
  }

  if (checking) return null

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-orange-50 grid place-items-center border border-orange-200">
            <KeyRound className="h-6 w-6 text-orange-600" />
          </div>
        <h1 className="text-lg font-semibold text-slate-900">Defina sua nova senha</h1>
          <p className="text-sm text-slate-500">Crie uma nova senha para continuar.</p>
        </div>

        {error && (
          <div className="mb-4 rounded bg-red-50 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label mb-1">Nova senha</label>
            <input
              type="password"
              value={pwd1}
              onChange={(e) => setPwd1(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
              placeholder="••••••••"
              autoFocus
            />
          </div>
          <div>
            <label className="form-label mb-1">Confirmar nova senha</label>
            <input
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-950 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Salvando…' : 'Salvar e entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
