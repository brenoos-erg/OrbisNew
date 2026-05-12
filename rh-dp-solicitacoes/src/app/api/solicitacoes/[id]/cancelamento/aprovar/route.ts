export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { VIEWER_ONLY_ACTION_ERROR, isViewerOnlyForSolicitation } from '@/lib/solicitationPermissionGuards'
import { analyzeCancellationRequest, assertRequiredReason, isClosedForCancellation, resolveCancellationContext } from '@/lib/solicitationCancellation'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { id } = await params
    const body = await req.json().catch(() => ({} as { justificativa?: string }))
    const justificativa = assertRequiredReason(body?.justificativa, 'justificativa')
    const solicitation = await prisma.solicitation.findUnique({ where: { id }, include: { solicitacaoSetores: { select: { setor: true } } } })
    if (!solicitation) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    if (isClosedForCancellation(solicitation.status)) return NextResponse.json({ error: 'Esta solicitação já está encerrada e não pode ser cancelada.' }, { status: 400 })
    if (solicitation.cancelamentoStatus !== 'PENDENTE') return NextResponse.json({ error: 'Não há pedido de cancelamento pendente.' }, { status: 400 })
    const isViewerOnly = await isViewerOnlyForSolicitation({ solicitationId: id, userId: me.id })
    if (isViewerOnly) return NextResponse.json({ error: VIEWER_ONLY_ACTION_ERROR }, { status: 403 })
    const { canOperationallyCancel } = await resolveCancellationContext(me, solicitation)
    if (!canOperationallyCancel || solicitation.solicitanteId === me.id) return NextResponse.json({ error: 'Você não possui permissão para aprovar este cancelamento.' }, { status: 403 })
    const updated = await analyzeCancellationRequest({ solicitationId: id, actorId: me.id, actorName: me.fullName ?? me.id, justificativa, approve: true })
    return NextResponse.json({ ok: true, solicitation: updated })
  } catch (error: any) {
    if (error?.status) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('POST /api/solicitacoes/[id]/cancelamento/aprovar error', error)
    return NextResponse.json({ error: 'Erro ao aprovar cancelamento.' }, { status: 500 })
  }
}
