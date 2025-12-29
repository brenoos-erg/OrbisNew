// src/app/dashboard/direito-de-recusa/page.tsx
import { redirect } from 'next/navigation'
import { ModuleLevel } from '@prisma/client'
import { getCurrentAppUser } from '@/lib/auth'
import RefusalDashboardClient from './RefusalDashboardClient'

const ORDER: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

function hasMinLevel(level: ModuleLevel | undefined, min: ModuleLevel) {
  if (!level) return false
  return ORDER.indexOf(level) >= ORDER.indexOf(min)
}

export default async function Page() {
  const { appUser } = await getCurrentAppUser()
  if (!appUser) redirect('/login')

  const level =
    appUser.moduleLevels?.['direito-de-recusa'] ??
    appUser.moduleLevels?.['direito_de_recusa']

  if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
    redirect('/dashboard/direito-de-recusa/minhas')
  }

  const canReview = true

  return <RefusalDashboardClient canReview={canReview} />
}