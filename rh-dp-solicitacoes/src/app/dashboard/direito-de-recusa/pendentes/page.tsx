import { redirect } from 'next/navigation'
import { ModuleLevel } from '@prisma/client'
import { getCurrentAppUser } from '@/lib/auth'
import RefusalDashboardClient from '../RefusalDashboardClient'

const ORDER: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

function hasMinLevel(level: ModuleLevel | undefined, min: ModuleLevel) {
  if (!level) return false
  return ORDER.indexOf(level) >= ORDER.indexOf(min)
}

export default async function PendingRefusalsPage() {
  const { appUser } = await getCurrentAppUser()
  if (!appUser) redirect('/login')

  const level =
    appUser.moduleLevels?.['direito-de-recusa'] ??
    appUser.moduleLevels?.['direito_de_recusa']

  if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
    redirect('/dashboard/direito-de-recusa/minhas')
  }

  return (
    <RefusalDashboardClient
      canReview
      title="Pendentes para avaliar"
      description="Visualize as recusas atribuídas ao seu nome e registre a decisão."
      defaultStatus="PENDENTE"
      showStatusFilter={false}
    />
  )
}