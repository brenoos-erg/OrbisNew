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

export async function getUserSectorCostCenterIds(userId: string, db: DbClient = prisma): Promise<string[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      costCenterId: true,
      departmentId: true,
      costCenters: { select: { costCenterId: true } },
      userDepartments: { select: { departmentId: true } },
    },
  })

  if (!user) return []

  const ids = new Set<string>()
  if (user.costCenterId) ids.add(user.costCenterId)
  for (const link of user.costCenters) if (link.costCenterId) ids.add(link.costCenterId)

  const departmentIds = new Set<string>()
  if (user.departmentId) departmentIds.add(user.departmentId)
  for (const dep of user.userDepartments) if (dep.departmentId) departmentIds.add(dep.departmentId)

  if (departmentIds.size) {
    const centers = await db.costCenter.findMany({
      where: { departmentId: { in: Array.from(departmentIds) } },
      select: { id: true },
    })
    for (const center of centers) ids.add(center.id)
  }

  return Array.from(ids)
}

type NonConformityAccessInput = {
  userId: string
  level: ModuleLevel | undefined
  ncSolicitanteId: string
  centroQueDetectouId: string | null
  centroQueOriginouId: string | null
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
  return Boolean(
    (centroQueDetectouId && cc.has(centroQueDetectouId)) ||
      (centroQueOriginouId && cc.has(centroQueOriginouId)),
  )
}

export function canUserTreatNc(input: NonConformityAccessInput): boolean {
  return canUserAccessNc(input)
}