import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeUpsertSolicitationSearchIndex } from '@/lib/solicitationSearchIndex'
import { requireActiveUser } from '@/lib/auth'
import { notifySolicitationEvent } from '@/lib/solicitationOperationalNotifications'
import { canViewSensitiveHiringRequest, getUserDepartmentIds } from '@/lib/sensitiveHiringRequests'
import { VIEWER_ONLY_ACTION_ERROR, isViewerOnlyForSolicitation } from '@/lib/solicitationPermissionGuards'
import { resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'
import { canExecuteSolicitationRouteAction } from '@/lib/solicitationRouteActionAuthorization'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const solicitationId = (await params).id

    const isViewerOnly = await isViewerOnlyForSolicitation({ solicitationId, userId: me.id })
    if (isViewerOnly) {
      return NextResponse.json({ error: VIEWER_ONLY_ACTION_ERROR }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const text = typeof body?.texto === 'string' ? body.texto.trim() : ''

    if (!text) {
      return NextResponse.json(
        { error: 'Informe a observação para registrar o comentário.' },
        { status: 400 },
      )
    }

    const solicitation = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
      select: {
        id: true,
        tipoId: true,
        status: true,
        costCenterId: true,
        departmentId: true,
        approverId: true,
        assumidaPorId: true,
        solicitanteId: true,
        payload: true,
        solicitacaoSetores: { select: { setor: true, status: true, finalizadoEm: true } },
        tipo: { select: { id: true, codigo: true, nome: true } },
      },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (solicitation.status === 'CONCLUIDA' || solicitation.status === 'CANCELADA') {
      return NextResponse.json(
        { error: 'Não é possível adicionar observações em solicitações finalizadas ou canceladas.' },
        { status: 400 },
      )
    }

    const userDepartmentIds = await getUserDepartmentIds(me.id, me.departmentId)
    const canViewSensitive = canViewSensitiveHiringRequest({
      user: { id: me.id, role: me.role },
      solicitation: {
        solicitanteId: solicitation.solicitanteId,
        assumidaPorId: solicitation.assumidaPorId,
        approverId: solicitation.approverId,
        departmentId: solicitation.departmentId,
        tipo: solicitation.tipo,
      },
      isResponsibleDepartmentMember: userDepartmentIds.includes(solicitation.departmentId),
      isExplicitRecipient: solicitation.approverId === me.id,
    })

    const userAccess = await resolveUserAccessContext({
      userId: me.id,
      userLogin: me.login,
      userEmail: me.email,
      userFullName: me.fullName,
      role: me.role,
      primaryDepartmentId: me.departmentId,
      primaryDepartment: me.department,
    })
    const canCommentWithSensitivity = canExecuteSolicitationRouteAction('comentarios', userAccess, solicitation) && canViewSensitive

    if (!canCommentWithSensitivity) {
      return NextResponse.json(
        { error: 'Você não possui permissão para registrar observações nesta solicitação.' },
        { status: 403 },
      )
    }

    await prisma.comment.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        autorId: me.id,
        texto: text,
      },
    })

  await prisma.solicitationTimeline.create({
      data: {
        solicitationId,
        status: solicitation.status,
        message: `Observação registrada por ${me.fullName ?? me.id}: ${text}`,
      },
    })

    await notifySolicitationEvent({
      solicitationId,
      event: 'UPDATED',
      actorName: me.fullName ?? me.id,
      reason: text,
      dedupeKey: `COMMENT:${solicitationId}:${text.slice(0, 80)}` ,
    })

    void safeUpsertSolicitationSearchIndex(solicitationId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/solicitacoes/[id]/comentarios error', error)
    return NextResponse.json(
      { error: 'Erro ao registrar observação da solicitação.' },
      { status: 500 },
    )
  }
}