import { Action, ModuleLevel, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { ensureRequestContext, memoizeRequest } from '@/lib/request-metrics'

function normalizeModuleKey(moduleKey: string) {
  return moduleKey.trim().toLowerCase()
}

function normalizeFeatureKey(featureKey: string) {
  return featureKey.trim().toUpperCase()
}

export function mapLevelToDefaultActions(level: ModuleLevel): Action[] {
  switch (level) {
    case 'NIVEL_1':
      return ['VIEW']
    case 'NIVEL_2':
      return ['VIEW', 'CREATE', 'UPDATE']
    case 'NIVEL_3':
      return ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE']
    default:
      return []
  }
}
async function loadFeatureGrantsForLevel(moduleKey: string, level: ModuleLevel) {
  const grants = await prisma.featureLevelGrant.findMany({
    where: {
      level,
      feature: {
        module: { key: { equals: moduleKey, mode: 'insensitive' } },
      },
    },
    select: { actions: true, feature: { select: { key: true } } },
  })

  const map = new Map<string, Action[]>()
  for (const grant of grants) {
    map.set(normalizeFeatureKey(grant.feature.key), grant.actions)
  }

  return map
}

async function getFeatureGrantsForLevel(moduleKey: string, level: ModuleLevel) {
  const normalizedModuleKey = normalizeModuleKey(moduleKey)
  return memoizeRequest(`permissions/grants/${normalizedModuleKey}/${level}`, () =>
    loadFeatureGrantsForLevel(normalizedModuleKey, level),
  )
}


export async function getUserModuleLevel(userId: string, moduleKey: string): Promise<ModuleLevel | null> {
  const { levels } = await getUserModuleContext(userId)
  const normalizedKey = normalizeModuleKey(moduleKey)
  return levels[normalizedKey] ?? null
}

export async function canFeature(
  userId: string,
  moduleKey: string,
  featureKey: string,
  action: Action,
): Promise<boolean> {
  return ensureRequestContext('permissions/canFeature', async () => {
    const normalizedModuleKey = normalizeModuleKey(moduleKey)
    const normalizedFeatureKey = normalizeFeatureKey(featureKey)

    try {
      const level = await getUserModuleLevel(userId, normalizedModuleKey)
      if (!level) return false

      const levelGrants = await getFeatureGrantsForLevel(normalizedModuleKey, level)
      const grantActions = levelGrants.get(normalizedFeatureKey)

      if (grantActions) {
        return grantActions.includes(action)
      }

      const fallbackActions = mapLevelToDefaultActions(level)
      return fallbackActions.includes(action)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientInitializationError) {
        console.error('Não foi possível verificar permissões: banco de dados indisponível.', error)
        return false
      }
      console.error('Erro ao verificar permissões.', error)
      return false
    }
  })
}

export async function assertCanFeature(
  userId: string,
  moduleKey: string,
  featureKey: string,
  action: Action,
) {
  const allowed = await canFeature(userId, moduleKey, featureKey, action)
  if (!allowed) {
    throw new Error(`Acesso negado para ${featureKey} (${action}).`)
  }
}