// src/app/dashboard/solicitacoes/layout.tsx
import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/auth'
import {
  getUserModuleContext,
  userHasDepartmentOrCostCenter,
} from '@/lib/moduleAccess'
import { ModuleLevel } from '@prisma/client'

export default async function SolicitacoesLayout({
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

  const [context, hasStructure] = await Promise.all([
    getUserModuleContext(appUser.id),
    userHasDepartmentOrCostCenter(
      appUser.id,
      appUser.costCenterId,
      appUser.departmentId,
    ),
  ])

 const order: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']
  const solicitLevel = context.levels['solicitacoes']
  const canAccess =
    solicitLevel !== undefined &&
    order.indexOf(solicitLevel) >= order.indexOf(ModuleLevel.NIVEL_1) &&
    hasStructure

  if (!canAccess) {
    redirect('/dashboard')
  }

  return <>{children}</>
}