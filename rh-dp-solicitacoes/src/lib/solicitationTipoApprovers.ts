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

export async function resolveTipoApproverId(tipoId: string): Promise<string | null> {
  const ids = await resolveTipoApproverIds(tipoId)
  return pickEligibleTipoApproverId(ids)
}