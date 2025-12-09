'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

type Me = { fullName?: string; email?: string }

export default function Sidebar() {
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    let alive = true

    async function load() {
      // tenta direto da sessão do supabase (mais rápido)
      const sb = supabaseBrowser()
      const { data: { user } } = await sb.auth.getUser()
      if (alive && user) {
        // tenta o espelho do banco para pegar fullName salvo
        const r = await fetch('/api/me', { cache: 'no-store' })
        if (r.ok) setMe(await r.json())
        else setMe({ fullName: user.user_metadata?.name ?? user.email, email: user.email })
      } else if (alive) {
        setMe(null)
      }
    }

    load()
    return () => { alive = false }
  }, [])

  return (
    <aside className="flex h-full w-64 flex-col">
      {/* ... seus itens de menu ... */}
      <div className="mt-auto border-t px-4 py-3 text-xs text-slate-600">
        {me?.fullName ? (
          <>
            <div className="font-medium truncate">{me.fullName}</div>
            <div className="opacity-70 truncate">{me.email}</div>
          </>
        ) : (
          <div className="opacity-70">Não autenticado</div>
        )}
        
      </div>
    </aside>
  )
}
