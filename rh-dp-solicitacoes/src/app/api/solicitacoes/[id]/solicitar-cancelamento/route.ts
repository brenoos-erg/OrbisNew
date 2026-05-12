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
  registerCancellationRequest,
  resolveCancellationContext,
} from '@/lib/solicitationCancellation'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { id } = await params
    const body = await req.json().catch(() => ({} as { motivo?: string }))
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
    if (action !== 'REQUEST') {
      return NextResponse.json(
        { error: action === 'DIRECT' ? 'Esta solicitação ainda permite cancelamento direto.' : 'Você não possui permissão para solicitar o cancelamento desta solicitação.' },
        { status: 403 },
      )
    }

    const updated = await registerCancellationRequest({ solicitationId: id, actorId: me.id, motivo })
    return NextResponse.json({ ok: true, solicitation: updated })
  } catch (error: any) {
    if (error?.status) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('POST /api/solicitacoes/[id]/solicitar-cancelamento error', error)
    return NextResponse.json({ error: 'Erro ao solicitar cancelamento.' }, { status: 500 })
  }
}
