'use client'
import { useMemo } from 'react'
import { useSessionMe } from '@/components/session/SessionProvider'

type Me = { fullName?: string; email?: string }

export default function Sidebar() {
  const { data } = useSessionMe()

  const me = useMemo<Me | null>(() => {
    if (!data?.appUser) return null
    return {
      fullName: data.appUser.fullName,
      email: data.appUser.email,
    }
  }, [data])


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
