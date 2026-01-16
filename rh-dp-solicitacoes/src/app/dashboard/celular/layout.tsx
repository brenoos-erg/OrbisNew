// src/app/dashboard/celular/layout.tsx
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { ModuleLevel } from '@prisma/client'
import { MODULE_KEYS } from '@/lib/featureKeys'

export default async function CelularLayout({
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
  const moduleAccess = levels[MODULE_KEYS.CELULAR]
  const order: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

  if (!moduleAccess || order.indexOf(moduleAccess) < order.indexOf(ModuleLevel.NIVEL_1)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}