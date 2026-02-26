import { redirect } from 'next/navigation'
import { Action, ModuleLevel } from '@prisma/client'
import { getCurrentAppUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { assertCanFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import FluxoSolicitacaoClient from './FluxoSolicitacaoClient'

export const dynamic = 'force-dynamic'

export default async function FluxoSolicitacaoPage() {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    redirect('/login')
  }

  try {
    await assertUserMinLevel(appUser.id, MODULE_KEYS.CONFIGURACOES, ModuleLevel.NIVEL_1)
    await assertCanFeature(appUser.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PAINEL, Action.VIEW)
  } catch {
    redirect('/dashboard')
  }

  return <FluxoSolicitacaoClient />
}