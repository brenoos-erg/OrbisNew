import { ModuleLevel, TipoApproverRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { pickEligibleTipoApproverId } from '@/lib/solicitationApproverRules'

async function resolveTipoRoleUserIds(tipoId: string, role: TipoApproverRole): Promise<string[]> {
  if (!tipoId) return []

  const rows = await prisma.tipoSolicitacaoApprover.findMany({
    where: {
      tipoId,
      role,
      user: {
        status: 'ATIVO',
        moduleAccesses: {
          some:
            role === TipoApproverRole.APPROVER
              ? {
                  level: ModuleLevel.NIVEL_3,
                  module: { key: MODULE_KEYS.SOLICITACOES },
                }
              : {
                  module: { key: MODULE_KEYS.SOLICITACOES },
                },
        },
      },
    },
    orderBy: [{ user: { fullName: 'asc' } }, { createdAt: 'asc' }],
    select: { userId: true },
  })

  return rows.map((row) => row.userId)
}
export async function resolveTipoApproverIds(tipoId: string): Promise<string[]> {
  return resolveTipoRoleUserIds(tipoId, TipoApproverRole.APPROVER)
}

export async function resolveTipoViewerIds(tipoId: string): Promise<string[]> {
  return resolveTipoRoleUserIds(tipoId, TipoApproverRole.VIEWER)
}

export async function resolveTipoFinalizerIds(tipoId: string): Promise<string[]> {
  return resolveTipoRoleUserIds(tipoId, TipoApproverRole.FINALIZER)
}

export async function resolveTipoApproverId(tipoId: string): Promise<string | null> {
  const ids = await resolveTipoApproverIds(tipoId)
  return pickEligibleTipoApproverId(ids)
}

export async function resolveNivel3TiApproverId(): Promise<string | null> {
  const users = await prisma.user.findMany({
    where: {
      status: 'ATIVO',
      moduleAccesses: {
        some: {
          level: ModuleLevel.NIVEL_3,
          module: { key: MODULE_KEYS.SOLICITACOES },
        },
      },
      OR: [
        { department: { code: '20' } },
        { userDepartments: { some: { department: { code: '20' } } } },
      ],
    },
    orderBy: [{ fullName: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  })

  return users[0]?.id ?? null
}

export async function resolveTipoApproverIdWithFallback(tipoId: string): Promise<{
  approverId: string | null
  source: 'TIPO' | 'NIVEL_3_TI' | 'NONE'
}> {
  const tipoApproverId = await resolveTipoApproverId(tipoId)
  if (tipoApproverId) {
    return { approverId: tipoApproverId, source: 'TIPO' }
  }

  const fallbackLevel3TiApproverId = await resolveNivel3TiApproverId()
  if (fallbackLevel3TiApproverId) {
    return { approverId: fallbackLevel3TiApproverId, source: 'NIVEL_3_TI' }
  }

  return { approverId: null, source: 'NONE' }
}
