import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { ModuleLevel } from '@prisma/client'

export default async function TiEquipmentsLayout({ children }: { children: ReactNode }) {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    redirect('/login')
  }

  if (appUser.status === 'INATIVO') {
    redirect('/login?inactive=1')
  }

  const { levels } = await getUserModuleContext(appUser.id)
  const equipmentAccess = levels[MODULE_KEYS.EQUIPAMENTOS_TI]
  const order: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

  if (!equipmentAccess || order.indexOf(equipmentAccess) < order.indexOf(ModuleLevel.NIVEL_1)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}