'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LogIn, Loader2 } from 'lucide-react'
import { clearSessionMeCache } from '@/lib/session-cache'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const search = useSearchParams()
  const nextUrl = search.get('next') || '/dashboard'
  const isLogoutRequest = search.get('logout') === '1'
  const [loading, setLoading] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [showReset, setShowReset] = useState(false)
  const [resetIdentifier, setResetIdentifier] = useState('')
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isLogoutRequest) {
      fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' })
        .then(() => {
          clearSessionMeCache()
          setLogoutMessage('Você saiu da conta com sucesso.')
        })
        .catch(() => null)
      return
    }

    fetch('/api/session/bootstrap', { cache: 'no-store' })
      .then((res) => {
        if (res.ok) router.replace(nextUrl)
      })
      .catch(() => null)
  }, [isLogoutRequest, nextUrl, router])

  async function handleLogin() {
    setLoading(true)
    setLoginError(null)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    }).catch(() => null)

    if (!res) {
       setLoading(false)
      setLoginError('Não foi possível conectar ao servidor de autenticação.')
      return
    }

    const payload = await res.json().catch(() => null)
    setLoading(false)

    if (!res.ok) {
      if ((res.status === 428 || res.status === 409) && payload?.reason === 'NO_PASSWORD') {
        setShowReset(true)
        setResetIdentifier(identifier)
        setLoginError('Usuário ainda não possui senha. Clique em “Esqueci minha senha” para criar.')
        return
      }

      const statusMessage: Record<number, string> = {
        400: 'Identificador e senha são obrigatórios.',
        401: 'Credenciais inválidas.',
        403: 'Usuário inativo.',
        500: 'Erro interno no servidor de autenticação.',
      }
      setLoginError(payload?.error || statusMessage[res.status] || 'Falha ao autenticar.')
      return
    }

    if (payload?.mustChangePassword) {
      router.replace(`/primeiro-acesso?next=${encodeURIComponent(nextUrl)}`)
      return
    }

    router.replace(nextUrl)
    router.refresh()
  }

  async function handleResetClick() {
    const res = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: resetIdentifier || identifier, next: nextUrl }),
    })
    if (res.ok) setResetMsg('Se o usuário existir, o token de redefinição foi gerado.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-3xl border-2 border-orange-300 bg-white p-10">
        {logoutMessage && <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{logoutMessage}</div>}
        {loginError && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{loginError}</div>}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-orange-300 bg-orange-50">
            <LogIn className="h-6 w-6 text-orange-500" />
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Sistema de Gestão Integrada</h1>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void handleLogin() }} className="space-y-5">
          <input type="text" required placeholder="Email ou login" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm" />
          <input type="password" required placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm" />

          <button type="button" onClick={() => setShowReset(!showReset)} className="text-xs text-orange-600 hover:underline">Esqueci minha senha</button>
          {showReset && (
            <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3">
              <input type="text" placeholder="Email ou login" value={resetIdentifier} onChange={(e) => setResetIdentifier(e.target.value)} className="w-full rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm" />
              <button type="button" onClick={handleResetClick} className="mt-2 inline-flex rounded-md bg-slate-900 px-3 py-2 text-xs text-white">Gerar recuperação</button>
              {resetMsg && <div className="mt-2 text-[12px] text-green-700">{resetMsg}</div>}
            </div>
          )}

          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {loading ? 'Entrando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}
