'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Loader2, LogIn } from 'lucide-react'

export default function LoginPage() {
  const [loadingSession, setLoadingSession] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = '/dashboard'
      else setLoadingSession(false)
    })
  }, [])

 async function handleLogin(e: React.FormEvent) {
  e.preventDefault()
  setLoading(true)

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  setLoading(false)

  if (error) {
    alert(error.message)
  } else {
    // 🔽 1) SINCRONIZA o usuário (auth.users → public."User")
    await fetch('/api/session/sync', { method: 'POST' })

    // 🔽 2) REDIRECIONA para a área logada
    window.location.href = '/dashboard'
  }
}


  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {/* CARD MAIOR + PREDOMINANTEMENTE AZUL, COM ACENTO LARANJA */}
      <div className="w-full max-w-xl rounded-3xl border-2 border-orange-300 bg-white p-10 shadow-[0_20px_60px_-20px_rgba(2,6,23,.25)]">
        {/* Cabeçalho */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-orange-300 bg-orange-50">
            <LogIn className="h-6 w-6 text-orange-500" />
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Canal de Solicitações
          </h1>
          <p className="text-xs text-slate-500">RH ↔ DP</p>
        </div>

        {/* Form */}
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
            style={{ boxShadow: '0 0 0 2px rgba(251,146,60,.4) inset' }} // anel laranja sutil
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {loading ? 'Entrando...' : 'Entrar no Sistema'}
          </button>
        </form>

        {/* Rodapé (teste) */}
        <div className="mt-8 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-center text-xs text-orange-700">
          <p className="font-medium">Usuários de Teste:</p>
          <p>admin@empresa.com • coord@empresa.com • topo@empresa.com</p>
          <p>Senha: 123456</p>
        </div>
      </div>
    </div>
  )
}
