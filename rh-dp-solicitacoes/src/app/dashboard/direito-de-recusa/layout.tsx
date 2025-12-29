// src/app/dashboard/direito-de-recusa/layout.tsx
import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { ModuleLevel } from '@prisma/client'
import { getCurrentAppUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'

const ORDER: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

function hasMinLevel(level: ModuleLevel | undefined, min: ModuleLevel) {
  if (!level) return false
  return ORDER.indexOf(level) >= ORDER.indexOf(min)
}

export default async function RefusalLayout({
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
  const moduleLevel = levels['direito-de-recusa'] ?? levels['direito_de_recusa']

  if (!hasMinLevel(moduleLevel, ModuleLevel.NIVEL_1)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}