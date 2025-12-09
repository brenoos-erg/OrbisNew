// src/app/dashboard/gestao-de-frotas/layout.tsx
import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { ModuleLevel } from '@prisma/client'

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

const { levels } = await getUserModuleContext(appUser.id)
  const fleetAccess = levels['gestao-de-frotas'] ?? levels['gestao_frotas']
  const order: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

  if (!fleetAccess) {
    redirect('/dashboard')
  }

  return <>{children}</>
}