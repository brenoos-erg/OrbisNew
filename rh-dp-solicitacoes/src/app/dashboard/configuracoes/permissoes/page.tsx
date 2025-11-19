// src/app/dashboard/configuracoes/permissoes/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import PermissoesClient from './PermissoesClient'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    redirect('/login')
  }

  try {
    await assertUserMinLevel(appUser.id, 'configuracoes', 'NIVEL_3')
  } catch {
    redirect('/dashboard')
  }

  return <PermissoesClient />
}
