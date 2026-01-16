'use client'
import type { User } from '@supabase/supabase-js'
import { Suspense, useEffect, useState } from 'react'
import { clearSessionMeCache, fetchSessionMe } from '@/lib/session-cache'
import { supabaseBrowser } from '@/lib/supabase/client'
import { getSiteUrl } from '@/lib/site-url'
import { useRouter, useSearchParams } from 'next/navigation'
import { LogIn, Loader2 } from 'lucide-react'


export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}
function getSessionEmail() {
  if (typeof window === 'undefined') return ''
  return sessionStorage.getItem('resetEmail') ?? ''
}

function LoginPageContent() {
  const router = useRouter()
  const search = useSearchParams()
  const nextUrl = search.get('next') || '/dashboard'
  const isInactive = search.get('inactive') === '1'
  const isDbUnavailable = search.get('db-unavailable') === '1'
  const callbackError = search.get('error')
  const supabase = supabaseBrowser()

  const [loadingSession, setLoadingSession] = useState(true)
  const [loading, setLoading] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
   const [loginError, setLoginError] = useState<string | null>(null)
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null)


  // --- Reset de senha (esqueci) ---
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState<string>(() => getSessionEmail())
  const [sendingReset, setSendingReset] = useState(false)
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const [resetErr, setResetErr] = useState<string | null>(null)
  const shouldForceSignOut = search.get('logout') === '1'
  const rateLimitRemaining = rateLimitUntil
    ? Math.max(0, Math.ceil((rateLimitUntil - Date.now()) / 1000))
    : 0
  const isRateLimited = rateLimitRemaining > 0

  function handleRateLimit(message = 'Muitas tentativas em sequência. Aguarde alguns segundos e tente novamente.') {
    setRateLimitUntil(Date.now() + 30_000)
    alert(message)
  }

  function isRateLimitError(error: any) {
    const status = (error as any)?.status as number | undefined
    const message = String((error as any)?.message ?? '').toLowerCase()
    return status === 429 || message.includes('rate limit')
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('resetEmail', resetEmail)
  }, [resetEmail])

  useEffect(() => {
    let active = true
    // derruba a sessão apenas quando solicitado explicitamente e tenta reaproveitar sessões já válidas
    ;(async () => {
      if (shouldForceSignOut) {
        try { await supabase.auth.signOut({ scope: 'global' }) } catch {}
        try { await fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' }) } catch {}
        clearSessionMeCache()
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return

      if (user) {
        try {
          const me = await fetchSessionMe()
          if (!active) return
          if (me?.appUser?.status === 'INATIVO') {
            await supabase.auth.signOut({ scope: 'global' })
            router.replace('/login?inactive=1')
            router.refresh()
            return
          }
          if (me?.appUser) {
            router.replace(nextUrl)
            router.refresh()
            return
          }
          if (me?.dbUnavailable) {
            router.replace(`/login?db-unavailable=1&next=${encodeURIComponent(nextUrl)}`)
            router.refresh()
            return
          }
        } catch (err: any) {
          if (!active) return

          const status = (err as any)?.status as number | undefined
          const payload = (err as any)?.payload as any
          if (payload?.dbUnavailable) {
            router.replace(`/login?db-unavailable=1&next=${encodeURIComponent(nextUrl)}`)
            router.refresh()
            return
          }
          if (status && status !== 401) {
            setBootstrapError(err?.message || 'Falha ao carregar seus dados. Tente novamente.')
          }
        }
      }

      if (active) setLoadingSession(false)
    })()

    return () => {
      active = false
    }
  }, [shouldForceSignOut, supabase, router, nextUrl])
  async function resolveEmail(target: string) {
    const trimmed = target.trim()

    if (trimmed.includes('@')) return trimmed

    const res = await fetch(
      `/api/auth/resolve-identifier?identifier=${encodeURIComponent(trimmed)}`,
      { cache: 'no-store' },
    )
    const payload = await res.json().catch(() => null)
    // Ajuda o suporte a correlacionar falhas do backend.
    const requestId = payload?.requestId as string | undefined
    const withRequestId = (message: string) =>
      requestId ? `${message} (ID: ${requestId}). Tente novamente.` : `${message} Tente novamente.`

    if (res.status === 503 || payload?.dbUnavailable) {
      const error: any = new Error(
        'Serviço indisponível no momento. Tente novamente em instantes ou contate o administrador para conferir a DATABASE_URL no Vercel.',
      )
      error.dbUnavailable = true
      throw error
    }
    if (res.status === 429) {
      const error: any = new Error('Muitas tentativas em sequência. Aguarde alguns segundos e tente novamente.')
      error.status = 429
      throw error
    }

    if (res.status >= 500) {
      const message = payload?.error
        ? String(payload.error)
        : 'Falha no serviço.'
      throw new Error(withRequestId(message))
    }

    if (res.status === 400) {
      throw new Error(payload?.error || 'Identificador inválido. Verifique e tente novamente.')
    }

    if (res.status === 404) {
      throw new Error('Login não encontrado. Verifique e tente novamente.')
    }

    if (!res.ok) {
      throw new Error(payload?.error || 'Login não encontrado. Verifique e tente novamente.')
    }

    const data = payload
    if (!data?.email) throw new Error('Login não encontrado. Verifique e tente novamente.')

    return data.email as string
  }


  async function handleLogin() {
    if (loading) return
    if (isRateLimited) {
      setLoginError(`Aguarde ${rateLimitRemaining}s para tentar novamente.`)
      return
    }
    setLoading(true)
    setLoginError(null)

    let authenticatedUser: User | null = null

    let emailToUse = identifier
    try {
      emailToUse = await resolveEmail(identifier)
    } catch (err: any) {
      setLoading(false)
       if (err?.dbUnavailable) {
        router.replace(`/login?db-unavailable=1&next=${encodeURIComponent(nextUrl)}`)
        router.refresh()
        return
      }
      setLoginError(err?.message || 'Não foi possível localizar seu acesso. Tente novamente.')
      return
    }

    // 1️⃣ Tenta autenticar com Supabase
    const { data, error } = await supabase.auth.signInWithPassword({ email: emailToUse, password })
     if (error) {
      setLoading(false)
      if (isRateLimitError(error)) {
        handleRateLimit(error.message)
        return
      }
      setLoginError(error.message || 'Não foi possível autenticar. Tente novamente.')
      return
    }
    authenticatedUser = data.user

    // 2️⃣ Sincroniza e carrega dados do backend em uma única chamada
    let bootstrapDbUnavailable = false
    try {
      const me = await fetchSessionMe({ force: true })
      if (me?.dbUnavailable) {
        bootstrapDbUnavailable = true
      }
      if (!bootstrapDbUnavailable && !me?.appUser) {
        setLoading(false)
        setLoginError(me?.error || 'Não foi possível carregar seus dados agora. Tente novamente.')
        return
      }
      if (me?.appUser?.status === 'INATIVO') {
        await supabase.auth.signOut({ scope: 'global' })
        setLoading(false)
        setLoginError('Seu usuário está INATIVO. Fale com o administrador.')
        router.replace('/login?inactive=1')
        router.refresh()
        return
      }
    } catch (err: any) {
      const payload = (err as any)?.payload as any
      const status = (err as any)?.status as number | undefined

      if (payload?.dbUnavailable) {
        bootstrapDbUnavailable = true
      } else {
        setLoading(false)

        if (status === 401) {
          setLoginError('Sessão expirada. Faça login novamente.')
        } else {
          setLoginError(err?.message || 'Falha ao carregar seus dados. Tente novamente.')
        }
        return
      }
    }

    if (bootstrapDbUnavailable) {
      // mostra aviso mas mantém sessão já autenticada
      setLoginError('Não foi possível verificar seus dados agora. Vamos continuar assim mesmo.')
    }
    // 3️⃣ Se for primeiro acesso (mustChangePasswor
    if (!authenticatedUser) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      authenticatedUser = user
    }

    const must = (authenticatedUser?.user_metadata as any)?.mustChangePassword === true

    if (must) {
      router.replace(`/primeiro-acesso?next=${encodeURIComponent(nextUrl)}`)
    } else {
      router.replace(nextUrl)
    }
    router.refresh()
  }

  async function handleResetClick() {
    setResetErr(null)
    setResetMsg(null)
    if (isRateLimited) {
      setResetErr(`Aguarde ${rateLimitRemaining}s para tentar novamente.`)
      return
    }
    setSendingReset(true)
    try {
      let target = resetEmail.trim() || identifier.trim()
      if (!target) {
        setResetErr('Informe seu e-mail para enviar o link de recuperação.')
        setSendingReset(false)
        return
      }

      if (!target.includes('@')) {
        try {
          target = await resolveEmail(target)
        } catch (err: any) {
          setResetErr(err?.message || 'Login não encontrado. Verifique e tente novamente.')
          setSendingReset(false)
          return
        }
      }

      const siteUrl = getSiteUrl()
      const redirectTo = `${siteUrl}/auth/callback?next=/primeiro-acesso`

      if (process.env.NODE_ENV !== 'production') {
        console.info('[login/reset] resolved siteUrl', { siteUrl, redirectTo })
      }

      if (!siteUrl) throw new Error('NEXT_PUBLIC_SITE_URL não configurada.')

      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo,
      })
      if (error) {
        if (isRateLimitError(error)) {
          handleRateLimit(error.message)
          return
        }
        throw error
      }

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

        {/* Aviso de usuário INATIVO */}
        {isInactive && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            Sua conta está inativa. Solicite ativação ao administrador.
          </div>
        )}
        {callbackError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {callbackError}
          </div>
        )}
        {isDbUnavailable && (
          <div className="mb-4 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800">
              <p>Não foi possível conectar ao banco de dados. Tente novamente em alguns minutos ou contate o suporte.</p>
            <button
              type="button"
              onClick={() => {
                router.replace(`/login?next=${encodeURIComponent(nextUrl)}`)
                router.refresh()
              }}
              className="mt-2 inline-flex items-center rounded-md border border-orange-300 bg-white px-2.5 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100"
            >
              Tentar novamente
            </button>
          </div>
        )}
        {bootstrapError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {bootstrapError}
          </div>
        )}
 {loginError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {loginError}
          </div>
        )}
        {isRateLimited && (
          <div className="mb-4 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800">
            Muitas tentativas em sequência. Aguarde {rateLimitRemaining}s e tente novamente.
          </div>
        )}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-orange-300 bg-orange-50">
            <LogIn className="h-6 w-6 text-orange-500" />
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Sistema de Gestão Integrada</h1>
          <p className="text-xs text-slate-500">SGI</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleLogin()
          }}
          className="space-y-5"
        >
          <div>
            <label className="form-label mb-1">Email ou login</label>
            <input
              type="text"
              required
              placeholder="Ex: joao.silva"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value)
                if (loginError) setLoginError(null)
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
            />
          </div>

          <div>
              <div className="flex items-center justify-between">
                <label className="form-label mb-1">Senha</label>
                <button
                  type="button"
                  onClick={() => {
                    const willShow = !showReset
                    setShowReset(willShow)
                    if (willShow) {
                      setResetEmail((value) => value || identifier)
                    }
                    setResetMsg(null)
                    setResetErr(null)
                  }}
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
              onChange={(e) => {
                setPassword(e.target.value)
                if (loginError) setLoginError(null)
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
            />
          </div>

          {showReset && (
            <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3">
              <div className="text-[13px] text-slate-700 mb-2">
                Enviaremos um link para redefinir sua senha. Ao abrir o link, você será levado à página de definição de nova senha.
              </div>
              <div className="space-y-2">
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
                    type="button"
                    onClick={handleResetClick}
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
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || isRateLimited}
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
