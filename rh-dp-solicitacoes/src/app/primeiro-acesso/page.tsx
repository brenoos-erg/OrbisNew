'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeyRound, Loader2 } from 'lucide-react'

export default function PrimeiroAcessoPage() {
  return <Suspense fallback={null}><PrimeiroAcessoContent /></Suspense>
}

function PrimeiroAcessoContent() {
  const router = useRouter()
  const search = useSearchParams()
  const nextUrl = search.get('next') || '/dashboard'
  const [pwd1, setPwd1] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (pwd1.length < 6) return setError('A nova senha deve ter ao menos 6 caracteres.')
    if (pwd1 !== pwd2) return setError('As senhas não coincidem.')
    setSaving(true)
    const res = await fetch('/api/me/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: pwd1 }),
    })
    const payload = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setError(payload?.error || 'Falha ao atualizar senha.')
    router.replace(nextUrl)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow">
        <div className="mb-6 text-center"><KeyRound className="mx-auto h-6 w-6 text-orange-600" /></div>
        {error && <div className="mb-4 rounded bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" value={pwd1} onChange={(e) => setPwd1(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Nova senha" autoFocus />
          <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Confirmar senha" />
          <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Salvar e entrar</button>
        </form>
      </div>
    </div>
  )
}
