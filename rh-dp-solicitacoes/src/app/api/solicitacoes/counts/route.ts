import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { buildSensitiveHiringVisibilityWhere, getUserDepartmentIds } from '@/lib/sensitiveHiringRequests'
import {
  buildReceivedSolicitationVisibilityWhere,
  resolveUserSetorKeysFromDepartments,
} from '@/lib/solicitationVisibility'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const me = await requireActiveUser()

    const departmentLinks = await prisma.userDepartment.findMany({
      where: { userId: me.id },
      select: { departmentId: true, department: { select: { code: true, name: true } } },
    })

    const userDepartmentIds = new Set<string>()
    if (me.departmentId) userDepartmentIds.add(me.departmentId)
    for (const link of departmentLinks) userDepartmentIds.add(link.departmentId)

    const userDepartments = [
      ...(me.department ? [me.department] : []),
      ...departmentLinks.map((link) => link.department).filter((department): department is { code: string; name: string } => Boolean(department)),
    ]

    const userSetorKeys = resolveUserSetorKeysFromDepartments(userDepartments)

    const receivedVisibilityWhere = buildReceivedSolicitationVisibilityWhere({
      userId: me.id,
      role: me.role,
      userDepartmentIds: [...userDepartmentIds],
      userSetorKeys,
    })

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
                  { tipo: { nome: 'RQ_063 - Solicitação de Pessoal' } },
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