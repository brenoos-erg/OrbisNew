'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Loader2, LockKeyhole } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => supabaseBrowser(), [])

  const [status, setStatus] = useState<'checking' | 'missing' | 'ready' | 'error' | 'updating' | 'success'>('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code') || searchParams.get('token_hash')
    if (!code) {
      setStatus('missing')
      setError('Link de redefinição inválido ou expirado. Solicite um novo e-mail.')
      return
    }

    let cancelled = false
    setStatus('checking')
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (cancelled) return
        if (error) {
          setStatus('error')
          setError(error.message || 'Não foi possível validar seu link de redefinição.')
          return
        }
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
        setError('Não foi possível validar seu link de redefinição. Tente novamente.')
      })

    return () => {
      cancelled = true
    }
  }, [supabase, searchParams])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (status !== 'ready') return

    if (!password || password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setStatus('updating')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setStatus('ready')
      setError(error.message || 'Não foi possível atualizar sua senha. Tente novamente.')
      return
    }

    setPassword('')
    setConfirmPassword('')
    setStatus('success')
    setMessage('Senha atualizada com sucesso! Você já pode acessar o sistema com a nova senha.')
  }

  const loading = status === 'checking' || status === 'updating'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-3xl border-2 border-orange-200 bg-white p-8 shadow-[0_20px_60px_-20px_rgba(2,6,23,.25)]">
        <div className="mb-6 flex items-center gap-3 text-orange-700">
          <LockKeyhole className="h-8 w-8" />
          <div>
            <h1 className="text-xl font-semibold">Redefinição de senha</h1>
            <p className="text-sm text-slate-700">Confirme o código do e-mail e defina uma nova senha segura.</p>
          </div>
        </div>

        {status === 'checking' && (
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando seu link...
          </div>
        )}

        {status === 'missing' && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Não encontramos o código de redefinição. Solicite um novo e-mail de recuperação na página de login.
          </div>
        )}

        {status === 'error' && error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {(status === 'ready' || status === 'updating' || status === 'success') && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="password">
                Nova senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                placeholder="Digite uma nova senha"
                disabled={loading || status === 'success'}
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="confirm-password">
                Confirmar nova senha
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                placeholder="Repita a nova senha"
                disabled={loading || status === 'success'}
                minLength={8}
                required
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}
            {message && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={loading || status === 'success'}
                className="flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar nova senha'}
              </button>

              <button
                type="button"
                onClick={() => router.replace('/login')}
                className="text-sm font-semibold text-orange-700 hover:text-orange-800"
              >
                Voltar para o login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}