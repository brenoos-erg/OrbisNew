import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { ModuleLevel } from '@prisma/client'
import { getCurrentAppUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { MODULE_KEYS } from '@/lib/featureKeys'

export default async function ControleDocumentosLayout({ children }: { children: ReactNode }) {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) redirect('/login')
  if (appUser.status === 'INATIVO') redirect('/login?inactive=1')

  const { levels } = await getUserModuleContext(appUser.id)
  const level = levels[MODULE_KEYS.CONTROLE_DOCUMENTOS]

  if (!level || (level !== ModuleLevel.NIVEL_1 && level !== ModuleLevel.NIVEL_2 && level !== ModuleLevel.NIVEL_3)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
