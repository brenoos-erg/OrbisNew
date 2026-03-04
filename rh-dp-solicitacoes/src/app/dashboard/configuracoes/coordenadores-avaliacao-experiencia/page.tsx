import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/auth'
import { Role } from '@prisma/client'
import CoordenadoresAvaliacaoExperienciaClient from './CoordenadoresAvaliacaoExperienciaClient'

export default async function Page() {
  const { appUser } = await getCurrentAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== Role.ADMIN) redirect('/dashboard')

  return <CoordenadoresAvaliacaoExperienciaClient />
}