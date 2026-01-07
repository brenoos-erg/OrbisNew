// src/app/dashboard/configuracoes/permissoes/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/auth'
import { ModuleLevel, Action } from '@prisma/client'
import { assertUserMinLevel } from '@/lib/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'
import PermissoesClient from './PermissoesClient'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    redirect('/login')
  }

  try {
    await assertUserMinLevel(appUser.id, MODULE_KEYS.CONFIGURACOES, ModuleLevel.NIVEL_3)
    await assertCanFeature(appUser.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.VIEW)
  } catch {
    redirect('/dashboard')
  }

  return <PermissoesClient />
}