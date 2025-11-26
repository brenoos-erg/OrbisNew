// src/lib/moduleAccess.ts
import { prisma } from '@/lib/prisma'
import { ModuleLevel } from '@prisma/client'

export type AccessMap = Record<string, ModuleLevel>

export async function loadUserModuleAccess(userId: string): Promise<AccessMap> {
  const rows = await prisma.userModuleAccess.findMany({
    where: { userId },
    include: {
      module: { select: { key: true } },
    },
  })

  const map: AccessMap = {}
  for (const r of rows) {
    const moduleKey = r.module.key.toLowerCase()
    map[moduleKey] = r.level
  }
  return map
}

export async function userHasDepartmentOrCostCenter(
  userId: string,
  costCenterId?: string | null,
  departmentId?: string | null,
): Promise<boolean> {
  const [userRecord, extraCostCenters] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { costCenterId: true, departmentId: true },
    }),
    prisma.userCostCenter.count({
      where: { userId },
    }),
  ])

  const dbCostCenterId = userRecord?.costCenterId
  const dbDepartmentId = userRecord?.departmentId

  const hasPrimaryCostCenter = costCenterId ?? dbCostCenterId
  const hasPrimaryDepartment = departmentId ?? dbDepartmentId

  if (hasPrimaryCostCenter || hasPrimaryDepartment) {
    return true
  }

  return extraCostCenters > 0
}