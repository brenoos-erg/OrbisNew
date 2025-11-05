'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = '/login'
      } else {
        setUser(data.user)
      }
    })
  }, [])

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-600">
        Carregando...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-10">
      <h1 className="text-2xl font-bold text-slate-800">
        Bem-vindo, {user.email}
      </h1>
      <p className="mt-2 text-slate-600">
        Você está autenticado com sucesso.
      </p>

      <button
        onClick={async () => {
          await supabase.auth.signOut()
          window.location.href = '/login'
        }}
        className="mt-6 rounded-md bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-900"
      >
        Sair
      </button>
    </div>
  )
}
