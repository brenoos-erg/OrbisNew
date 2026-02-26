import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { getNivel3DepartmentIds } from '@/lib/solicitationApprovalPermissions'
import { resolveNadaConstaSetoresByDepartment } from '@/lib/solicitationTypes'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const me = await requireActiveUser()

    const ccIds = new Set<string>()
    const deptIds = new Set<string>()

    if (me.costCenterId) ccIds.add(me.costCenterId)
    if (me.departmentId) deptIds.add(me.departmentId)

    const [costCenterLinks, departmentLinks] = await Promise.all([
      prisma.userCostCenter.findMany({ where: { userId: me.id }, select: { costCenterId: true } }),
      prisma.userDepartment.findMany({
        where: { userId: me.id },
        select: { departmentId: true, department: { select: { code: true, name: true } } },
      }),
    ])

    for (const link of costCenterLinks) ccIds.add(link.costCenterId)
    for (const link of departmentLinks) deptIds.add(link.departmentId)

    const setorKeys = new Set<string>()
    for (const setor of resolveNadaConstaSetoresByDepartment(me.department)) {
      setorKeys.add(setor)
    }
    for (const link of departmentLinks) {
      for (const setor of resolveNadaConstaSetoresByDepartment(link.department)) {
        setorKeys.add(setor)
      }
    }

    const isDpUser = me.department?.code === '08' || departmentLinks.some((link) => link.department?.code === '08')
    const dpDepartmentId =
      me.department?.code === '08' ? me.departmentId : departmentLinks.find((link) => link.department?.code === '08')?.departmentId

    const receivedFilters = [
      ...(ccIds.size > 0 ? [{ costCenterId: { in: [...ccIds] } }] : []),
      ...(deptIds.size > 0 ? [{ departmentId: { in: [...deptIds] } }] : []),
      ...(isDpUser && dpDepartmentId ? [{ costCenterId: null, departmentId: dpDepartmentId }] : []),
      ...(setorKeys.size > 0 ? [{ solicitacaoSetores: { some: { setor: { in: [...setorKeys] } } } }] : []),
    ]

    const receivedOpenWhere: Record<string, any> = {
      status: 'ABERTA',
      AND:
        receivedFilters.length > 0
          ? [
              { OR: receivedFilters },
              {
                NOT: {
                  AND: [
                    { requiresApproval: true },
                    { approvalStatus: 'PENDENTE' },
                    { tipo: { nome: 'RQ_063 - Solicitação de Pessoal' } },
                  ],
                },
              },
            ]
          : [{ id: '__never__' }],
    }

    const allowedDepartmentIds = await getNivel3DepartmentIds(me.id)
    const approvalsPendingWhere: Record<string, any> = {
      requiresApproval: true,
      approvalStatus: 'PENDENTE',
      departmentId: allowedDepartmentIds.length > 0 ? { in: allowedDepartmentIds } : '__never__',
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