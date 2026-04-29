export const dynamic = 'force-dynamic'
export const revalidate = 0

// src/app/api/solicitacoes/[id]/assumir/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { notifySolicitationEvent } from '@/lib/solicitationOperationalNotifications'
import crypto from 'crypto'
import { canAssumeSolicitation, resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'
import { isViewerOnlyForSolicitation } from '@/lib/solicitationPermissionGuards'
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const { id: solicitationId } = await params

    const isViewerOnly = await isViewerOnlyForSolicitation({ solicitationId, userId: me.id })
    if (isViewerOnly) {
      return NextResponse.json({ error: 'Usuário visualizador não pode executar esta ação.' }, { status: 403 })
    }

    const solic = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
      include: { solicitacaoSetores: { select: { setor: true } } },
    })


     if (!solic) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    const userAccess = await resolveUserAccessContext({
      userId: me.id,
      userLogin: me.login,
      userEmail: me.email,
      userFullName: me.fullName,
      role: me.role,
      primaryDepartmentId: me.departmentId,
      primaryDepartment: me.department,
    })

    const canAssume = canAssumeSolicitation(userAccess, {
      tipoId: solic.tipoId,
      status: solic.status,
      solicitanteId: solic.solicitanteId,
      approverId: solic.approverId,
      assumidaPorId: solic.assumidaPorId,
      departmentId: solic.departmentId,
      solicitacaoSetores: solic.solicitacaoSetores,
      payload: solic.payload,
    })
    if (!canAssume) {
      return NextResponse.json(
        { error: 'Você não possui permissão para assumir este chamado.' },
        { status: 403 },
      )
    }

    if (solic.status === 'CONCLUIDA' || solic.status === 'CANCELADA') {
      return NextResponse.json(
        { error: 'Solicitação já foi finalizada.' },
        { status: 400 },
      )
    }

    const updated = await prisma.solicitation.update({
      where: { id: solicitationId },
      data: {
        // 👇 responsável pelo atendimento
        assumidaPorId: me.id,
        assumidaEm: new Date(),
        status: 'EM_ATENDIMENTO',
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId,
        status: 'EM_ATENDIMENTO',
        message: `Chamado assumido por ${me.fullName ?? me.id}.`,
      },
    })

     await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        actorId: me.id,
        tipo: 'ASSUMIU_CHAMADO',
      },
    })

    await notifySolicitationEvent({
      solicitationId,
      event: 'UPDATED',
      actorName: me.fullName ?? me.id,
      reason: 'Chamado assumido por responsável.',
      dedupeKey: `ASSUMIR:${solicitationId}:${me.id}`,
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('❌ POST /api/solicitacoes/[id]/assumir error:', e)
    return NextResponse.json(
      { error: 'Erro ao assumir a solicitação.' },
      { status: 500 },
    )
  }
}
