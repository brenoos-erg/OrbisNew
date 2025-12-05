// src/app/dashboard/gestao-de-frotas/layout.tsx
import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/auth'
import { loadUserModuleAccess } from '@/lib/moduleAccess'

export default async function FleetLayout({
  children,
}: {
  children: ReactNode
}) {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    redirect('/login')
  }

  if (appUser.status === 'INATIVO') {
    redirect('/login?inactive=1')
  }

  const access = await loadUserModuleAccess(appUser.id)
  const fleetAccess = access['gestao-de-frotas'] ?? access['gestao_frotas']

  if (!fleetAccess) {
    redirect('/dashboard')
  }

  return <>{children}</>
}