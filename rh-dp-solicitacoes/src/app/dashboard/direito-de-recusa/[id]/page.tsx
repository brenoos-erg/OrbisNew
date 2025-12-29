// src/app/dashboard/direito-de-recusa/[id]/page.tsx
import { redirect } from 'next/navigation'
import { ModuleLevel } from '@prisma/client'
import { getCurrentAppUser } from '@/lib/auth'
import RefusalDetailClient from '../RefusalDetailClient'

const ORDER: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

function hasMinLevel(level: ModuleLevel | undefined, min: ModuleLevel) {
  if (!level) return false
  return ORDER.indexOf(level) >= ORDER.indexOf(min)
}

export default async function Page({ params }: { params: { id: string } }) {
  const { appUser } = await getCurrentAppUser()
  if (!appUser) redirect('/login')

  const level =
    appUser.moduleLevels?.['direito-de-recusa'] ??
    appUser.moduleLevels?.['direito_de_recusa']

  const canReview = hasMinLevel(level, ModuleLevel.NIVEL_2)

  return <RefusalDetailClient reportId={params.id} canReview={canReview} />
}