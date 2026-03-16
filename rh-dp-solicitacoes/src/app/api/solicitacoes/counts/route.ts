import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { buildSensitiveHiringVisibilityWhere, getUserDepartmentIds } from '@/lib/sensitiveHiringRequests'
import { buildReceivedWhereByPolicy, resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const me = await requireActiveUser()

    const userAccess = await resolveUserAccessContext({
      userId: me.id,
      role: me.role,
      primaryDepartmentId: me.departmentId,
      primaryDepartment: me.department,
    })

    const receivedVisibilityWhere = buildReceivedWhereByPolicy(userAccess)


    const userDepartmentIdsForSensitive = await getUserDepartmentIds(me.id, me.departmentId)

    const receivedOpenWhere: Record<string, any> = {
      AND: [
        buildSensitiveHiringVisibilityWhere({
          userId: me.id,
          role: me.role,
          departmentIds: userDepartmentIdsForSensitive,
        }),
      ],
      OR: [
         {
          status: 'ABERTA',
          AND: [
            receivedVisibilityWhere,
            {
              NOT: {
                AND: [
                  { requiresApproval: true },
                  { approvalStatus: 'PENDENTE' },
                  { OR: [{ tipo: { id: 'RQ_063' } }, { tipo: { codigo: 'RQ.RH.001' } }] },
                ],
              },
            },
          ],
        },
        {
          status: 'AGUARDANDO_AVALIACAO_GESTOR',
          approverId: me.id,
        },
      ],
    }

    const approvalsPendingWhere: Record<string, any> = {
      AND: [
        buildSensitiveHiringVisibilityWhere({
          userId: me.id,
          role: me.role,
          departmentIds: userDepartmentIdsForSensitive,
        }),
      ],
      requiresApproval: true,
      approvalStatus: 'PENDENTE',
      OR: [
        { approverId: me.id },
        { tipo: { approvers: { some: { userId: me.id, role: 'APPROVER' } } } },
      ],
    }

    const [receivedOpenCount, approvalsPendingCount] = await Promise.all([
      prisma.solicitation.count({ where: receivedOpenWhere }),
      prisma.solicitation.count({ where: approvalsPendingWhere }),
    ])

    return NextResponse.json({ receivedOpenCount, approvalsPendingCount })
  } catch (error) {
    console.error('GET /api/solicitacoes/counts error', error)
    return NextResponse.json({ error: 'Erro ao carregar contagens de solicitações.' }, { status: 500 })
  }
}