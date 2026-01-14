'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { fetchSessionMe, type SessionMePayload } from '@/lib/session-cache'

type SessionContextValue = {
  data: SessionMePayload | null
  loading: boolean
  error: Error | null
  refresh: (options?: { force?: boolean }) => Promise<SessionMePayload | null>
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [data, setData] = useState<SessionMePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const hasLoadedRef = useRef(false)

  const buildNextUrl = useCallback(() => {
    const query = searchParams?.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams])

  const loadSession = useCallback(
    async (options?: { force?: boolean }) => {
      setLoading(true)
      try {
        const payload = await fetchSessionMe(options)
        setData(payload)
        setError(null)
        return payload
      } catch (err) {
        const typed = err as Error & { status?: number }
        setError(typed)
        setData(null)
        if (typed.status === 401 && pathname !== '/login') {
          const nextUrl = encodeURIComponent(buildNextUrl())
          router.replace(`/login?next=${nextUrl}`)
        }
        return null
      } finally {
        setLoading(false)
      }
    },
    [buildNextUrl, pathname, router],
  )

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    void loadSession()
  }, [loadSession])

  const mustChangePassword =
    data?.session?.user?.user_metadata?.mustChangePassword === true

  useEffect(() => {
    if (!mustChangePassword) return
    if (pathname.startsWith('/primeiro-acesso')) return
    const nextUrl = encodeURIComponent(buildNextUrl())
    router.replace(`/primeiro-acesso?next=${nextUrl}`)
  }, [buildNextUrl, mustChangePassword, pathname, router])

  const value = useMemo(
    () => ({
      data,
      loading,
      error,
      refresh: loadSession,
    }),
    [data, error, loadSession, loading],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSessionMe() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSessionMe deve ser usado dentro de SessionProvider')
  }
  return context
}