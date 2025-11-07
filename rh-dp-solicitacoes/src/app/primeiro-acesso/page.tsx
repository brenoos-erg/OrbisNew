'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { KeyRound, Loader2 } from 'lucide-react'

export default function PrimeiroAcessoPage() {
  const [sessionChecked, setSessionChecked] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.href = '/login'
      } else {
        setSessionChecked(true)
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPass.length < 6) {
      alert('A senha precisa ter ao menos 6 caracteres.')
      return
    }
    if (newPass !== confirm) {
      alert('As senhas não conferem.')
      return
    }
    setSaving(true)
    // 1) atualiza senha
    const { error } = await supabase.auth.updateUser({ password: novaSenha, data: { mustResetPassword: false } })
    setSaving(false)
    if (error) {
      alert(error.message)
      return
    }
    // 2) (Opcional) avisa backend para atualizar algo em public.User, se quiser
    // await fetch('/api/users/clear-first-access', { method: 'POST' }).catch(() => {})

    alert('Senha definida com sucesso!')
    window.location.href = '/dashboard'
  }

  if (!sessionChecked) return null

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-orange-50 grid place-items-center border border-orange-200">
            <KeyRound className="h-6 w-6 text-orange-600" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Definir nova senha</h1>
          <p className="text-sm text-slate-500">Por favor, crie sua senha para continuar.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nova senha</label>
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirmar nova senha</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {saving ? 'Salvando...' : 'Salvar senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
