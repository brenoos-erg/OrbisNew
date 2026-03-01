import { redirect } from 'next/navigation'
import { Action, ModuleLevel } from '@prisma/client'
import { getCurrentAppUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { assertCanFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import PoderesDeAcessoClient from './PoderesDeAcessoClient'

export const dynamic = 'force-dynamic'

export default async function PoderesDeAcessoPage() {
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

  return <PoderesDeAcessoClient />
}