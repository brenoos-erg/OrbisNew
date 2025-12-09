// src/lib/moduleAccess.ts
import { prisma } from '@/lib/prisma'
import { ModuleLevel } from '@prisma/client'

export type AccessMap = Record<string, ModuleLevel>

const LEVEL_ORDER: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

function pickHigherLevel(current: ModuleLevel | undefined, incoming: ModuleLevel) {
  if (!current) return incoming

  const currentIdx = LEVEL_ORDER.indexOf(current)
  const incomingIdx = LEVEL_ORDER.indexOf(incoming)

  return incomingIdx > currentIdx ? incoming : current
}

/**
 * Retorna o mapa final de níveis do usuário considerando:
 * - Módulos do departamento (sempre NIVEL_1 como base);
 * - Sobrescritas em UserModuleAccess (usadas para elevar nível, ex.: aprovadores NIVEL_3).
 *
 * Se um módulo existir tanto no departamento quanto no UserModuleAccess, mantém o maior nível.
 */
export async function getUserModuleContext(
  userId: string,
): Promise<{ levels: AccessMap; departmentCode: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      department: {
        select: {
          code: true,
          modules: {
            include: { module: { select: { key: true } } },
          },
        },
      },
      moduleAccesses: {
        include: { module: { select: { key: true } } },
      },
    },
  })
const levels: AccessMap = {}

  // Base: todos os módulos vinculados ao departamento ficam visíveis com NIVEL_1
  for (const deptModule of user?.department?.modules ?? []) {
    const key = deptModule.module.key.toLowerCase()
    levels[key] = ModuleLevel.NIVEL_1
  }
  
  // Sobrescritas individuais (UserModuleAccess) podem elevar o nível (ex.: aprovador NIVEL_3)
  for (const access of user?.moduleAccesses ?? []) {
    const key = access.module.key.toLowerCase()
    levels[key] = pickHigherLevel(levels[key], access.level)
  }

  return { levels, departmentCode: user?.department?.code ?? null }
}

export async function getUserModuleLevels(userId: string): Promise<AccessMap> {
  const { levels } = await getUserModuleContext(userId)
  return levels
}

// Mantido para compatibilidade: retorna o mapa final de módulos do usuário
export async function loadUserModuleAccess(userId: string): Promise<AccessMap> {
  return getUserModuleLevels(userId)
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