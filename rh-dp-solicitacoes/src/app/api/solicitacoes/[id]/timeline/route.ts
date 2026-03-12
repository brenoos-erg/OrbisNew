export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { canViewSensitiveHiringRequest, getUserDepartmentIds } from '@/lib/sensitiveHiringRequests'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const solicitationId = (await params).id

    const solicitation = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
      select: {
        id: true,
        solicitanteId: true,
        assumidaPorId: true,
        approverId: true,
        departmentId: true,
        tipo: { select: { id: true, codigo: true, nome: true } },
      },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    const userDepartmentIds = await getUserDepartmentIds(me.id, me.departmentId)
    const canView = canViewSensitiveHiringRequest({
      user: { id: me.id, role: me.role },
      solicitation,
      isResponsibleDepartmentMember: userDepartmentIds.includes(solicitation.departmentId),
    })

    if (!canView) {
      return NextResponse.json({ error: 'Você não possui permissão para visualizar esta solicitação.' }, { status: 403 })
    }


    const timelines = await prisma.solicitationTimeline.findMany({
      where: { solicitationId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(
      timelines.map((item) => ({
        id: item.id,
        status: item.status,
        message: item.message,
        createdAt: item.createdAt.toISOString(),
        actor: null,
      })),
    )
  } catch (error) {
    console.error('Erro em GET /api/solicitacoes/[id]/timeline', error)
    return NextResponse.json({ error: 'Erro ao buscar timeline' }, { status: 500 })
  }
}