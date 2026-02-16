import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { ModuleLevel } from '@prisma/client'
import { getCurrentAppUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

export default async function SstLayout({ children }: { children: ReactNode }) {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) redirect('/login')
  if (appUser.status === 'INATIVO') redirect('/login?inactive=1')

  const { levels } = await getUserModuleContext(appUser.id)
  const sstLevel = normalizeSstLevel(levels)

  if (!hasMinLevel(sstLevel, ModuleLevel.NIVEL_1)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}