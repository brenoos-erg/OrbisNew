// src/app/dashboard/configuracoes/usuarios/[id]/page.tsx
import { redirect } from 'next/navigation'
import { Action } from '@prisma/client'
import { getCurrentAppUser } from '@/lib/auth'
import { assertCanFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import Client from './UserProfilePageClient'

// Este componente é SERVER (sem "use client")
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    redirect('/login')
  }

  try {
    await assertCanFeature(
      appUser.id,
      MODULE_KEYS.CONFIGURACOES,
      FEATURE_KEYS.CONFIGURACOES.USUARIOS,
      Action.VIEW,
    )
  } catch {
    redirect('/dashboard')
  }

  // Next 15: params é uma Promise
  const { id } = await params
  return <Client userId={id} />
}