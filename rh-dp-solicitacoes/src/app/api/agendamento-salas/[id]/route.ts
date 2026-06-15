export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUserFromRouteHandler } from '@/lib/auth-route'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { appUser, requestId, dbUnavailable } = await getCurrentAppUserFromRouteHandler()
  if (!appUser) {
    return NextResponse.json(
      dbUnavailable ? { error: 'Banco indisponível.', dbUnavailable: true, requestId } : { error: 'Não autenticado', requestId },
      { status: dbUnavailable ? 503 : 401 },
    )
  }
  const allowed = await canFeature(appUser.id, MODULE_KEYS.AGENDAMENTO_SALAS, FEATURE_KEYS.AGENDAMENTO_SALAS.CANCELAR, Action.DELETE)
  if (!allowed) return NextResponse.json({ error: 'Acesso negado ao cancelamento.', requestId }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const booking = await (prisma as any).meetingRoomBooking.update({
    where: { id },
    data: {
      status: 'CANCELADA',
      cancelReason: body?.cancelReason ? String(body.cancelReason) : null,
      canceledAt: new Date(),
      canceledById: appUser.id,
    },
  })
  return NextResponse.json({ booking, message: 'Agendamento cancelado.' })
}
