// src/lib/moduleAccess.ts
import { prisma } from '@/lib/prisma'
import { ModuleLevel } from '@prisma/client'
import { ensureRequestContext, memoizeRequest } from '@/lib/request-metrics'
import { normalizeModuleKey } from '@/lib/moduleKey'

export type AccessMap = Record<string, ModuleLevel>

const LEVEL_ORDER: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']
const MODULE_LEVELS_TTL_MS = 60_000

const moduleContextCache = new Map<
  string,
  { expiresAt: number; value: Promise<{ levels: AccessMap; departmentCode: string | null }> }
>()


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
async function loadUserModuleContext(
  userId: string,
): Promise<{ levels: AccessMap; departmentCode: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      department: {
        select: {
          code: true,
          modules: {
            include: { module: { select: { key: true } } },
          },
        },
      },
       userDepartments: {
        include: {
          department: {
            select: {
              code: true,
              modules: { include: { module: { select: { key: true } } } },
            },
          },
        },
      },
      moduleAccesses: {
        include: { module: { select: { key: true } } },
      },
    },
  })
  const levels: AccessMap = {}

 
  if (user?.role === 'ADMIN') {
    const modules = await prisma.module.findMany({ select: { key: true } })
    for (const module of modules) {
      levels[normalizeModuleKey(module.key)] = ModuleLevel.NIVEL_3
    }

    return {
      levels,
      departmentCode:
        user.department?.code ??
        user.userDepartments.find((d) => d.department?.code)?.department?.code ??
        null,
    }
  }

  // Base: todos os módulos vinculados aos departamentos ficam visíveis com NIVEL_1
  const departments = [
    ...(user?.department ? [user.department] : []),
    ...(user?.userDepartments.map((link) => link.department) ?? []),
  ]

  for (const dept of departments) {
    for (const deptModule of dept?.modules ?? []) {
      const key = normalizeModuleKey(deptModule.module.key)
      levels[key] = ModuleLevel.NIVEL_1
    }
  }

  // Sobrescritas individuais (UserModuleAccess) podem elevar o nível (ex.: aprovador NIVEL_3)
  for (const access of user?.moduleAccesses ?? []) {
    const key = normalizeModuleKey(access.module.key)
    levels[key] = pickHigherLevel(levels[key], access.level)
  }

  const departmentCode =
    user?.department?.code ??
    user?.userDepartments.find((d) => d.department?.code)?.department?.code ??
    null

  return { levels, departmentCode }
}
function getCachedUserModuleContext(userId: string) {
  const now = Date.now()
  const cached = moduleContextCache.get(userId)

  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const pending = loadUserModuleContext(userId).catch((error) => {
    moduleContextCache.delete(userId)
    throw error
  })

  moduleContextCache.set(userId, {
    expiresAt: now + MODULE_LEVELS_TTL_MS,
    value: pending,
  })

  return pending
}


export async function getUserModuleContext(
  userId: string,
): Promise<{ levels: AccessMap; departmentCode: string | null }> {
  return ensureRequestContext('moduleAccess/context', () =>
    memoizeRequest(`moduleAccess/context/${userId}`, () => getCachedUserModuleContext(userId)),
  )
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
  const [userRecord, extraCostCenters, extraDepartments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { costCenterId: true, departmentId: true },
    }),
    prisma.userCostCenter.count({
      where: { userId },
    }),
    prisma.userDepartment.count({
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

  return extraCostCenters > 0 || extraDepartments > 0
}