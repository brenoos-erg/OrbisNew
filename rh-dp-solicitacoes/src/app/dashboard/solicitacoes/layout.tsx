// src/app/dashboard/solicitacoes/layout.tsx
import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/auth'
import {
  loadUserModuleAccess,
  userHasDepartmentOrCostCenter,
} from '@/lib/moduleAccess'

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

  const [access, hasStructure] = await Promise.all([
    loadUserModuleAccess(appUser.id),
    userHasDepartmentOrCostCenter(
      appUser.id,
      appUser.costCenterId,
      appUser.departmentId,
    ),
  ])

  const canAccess = !!access['solicitacoes'] && hasStructure

  if (!canAccess) {
    redirect('/dashboard')
  }

  return <>{children}</>
}