import { ModuleLevel, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hasMinLevel } from '@/lib/sst/access'

type DbClient = Prisma.TransactionClient | typeof prisma

export async function getUserCostCenterIds(userId: string, db: DbClient = prisma): Promise<string[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      costCenterId: true,
      costCenters: { select: { costCenterId: true } },
    },
  })

  if (!user) return []

  const ids = new Set<string>()
  if (user.costCenterId) ids.add(user.costCenterId)
  for (const link of user.costCenters) {
    if (link.costCenterId) ids.add(link.costCenterId)
  }

  return Array.from(ids)
}

type NonConformityAccessInput = {
  userId: string
  level: ModuleLevel | undefined
  ncSolicitanteId: string
  centroQueDetectouId: string
  centroQueOriginouId: string
  userCostCenterIds?: string[]
}

export function canUserAccessNc({
  userId,
  level,
  ncSolicitanteId,
  centroQueDetectouId,
  centroQueOriginouId,
  userCostCenterIds = [],
}: NonConformityAccessInput): boolean {
  if (hasMinLevel(level, ModuleLevel.NIVEL_2)) return true
  if (ncSolicitanteId === userId) return true

  const cc = new Set(userCostCenterIds)
  return cc.has(centroQueDetectouId) || cc.has(centroQueOriginouId)
}

export function canUserTreatNc(input: NonConformityAccessInput): boolean {
  return canUserAccessNc(input)
}