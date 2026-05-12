export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { VIEWER_ONLY_ACTION_ERROR, isViewerOnlyForSolicitation } from '@/lib/solicitationPermissionGuards'
import {
  CANCELLATION_CLOSED_ERROR,
  assertRequiredReason,
  isClosedForCancellation,
  registerDirectCancellation,
  resolveCancellationContext,
} from '@/lib/solicitationCancellation'

async function handler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { id } = await params

    const body = await req.json().catch(() => ({} as { motivo?: string; tipo?: string }))
    const motivo = assertRequiredReason(body?.motivo)

    const solicitation = await prisma.solicitation.findUnique({
      where: { id },
      include: { solicitacaoSetores: { select: { setor: true } } },
    })

    if (!solicitation) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    if (isClosedForCancellation(solicitation.status)) return NextResponse.json({ error: CANCELLATION_CLOSED_ERROR }, { status: 400 })

    const isViewerOnly = await isViewerOnlyForSolicitation({ solicitationId: id, userId: me.id })
    if (isViewerOnly) return NextResponse.json({ error: VIEWER_ONLY_ACTION_ERROR }, { status: 403 })

    const { action } = await resolveCancellationContext(me, solicitation)
    if (action !== 'DIRECT') {
      return NextResponse.json(
        { error: action === 'REQUEST' ? 'Esta solicitação já está em atendimento. Use a solicitação de cancelamento.' : 'Você não possui permissão para cancelar esta solicitação.' },
        { status: 403 },
      )
    }

    const updated = await registerDirectCancellation({
      solicitationId: id,
      previousStatus: solicitation.status,
      actorId: me.id,
      actorName: me.fullName ?? me.id,
      motivo,
    })

    return NextResponse.json({ ok: true, solicitation: updated })
  } catch (error: any) {
    if (error?.status) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('POST/PATCH /api/solicitacoes/[id]/cancelar error', error)
    return NextResponse.json({ error: 'Erro ao cancelar solicitação.' }, { status: 500 })
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handler(req, ctx)
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handler(req, ctx)
}
