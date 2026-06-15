export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { getCurrentAppUserFromRouteHandler } from '@/lib/auth-route'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'

export async function GET() {
  const { appUser, requestId, dbUnavailable } = await getCurrentAppUserFromRouteHandler()
  if (!appUser) {
    return NextResponse.json(
      dbUnavailable
        ? { error: 'Banco de dados indisponível no momento.', dbUnavailable: true, requestId }
        : { error: 'Não autenticado', requestId },
      { status: dbUnavailable ? 503 : 401 },
    )
  }

  const allowed = await canFeature(appUser.id, MODULE_KEYS.AGENDAMENTO_SALAS, FEATURE_KEYS.AGENDAMENTO_SALAS.ACESSAR, Action.VIEW)
  if (!allowed) return NextResponse.json({ error: 'Acesso negado ao agendamento de salas.', requestId }, { status: 403 })

  return NextResponse.json({
    user: {
      id: appUser.id,
      fullName: appUser.fullName,
      email: appUser.email,
      login: appUser.login,
    },
  })
}
