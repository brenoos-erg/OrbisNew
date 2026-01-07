import { Action, ModuleLevel } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getUserModuleContext } from '@/lib/moduleAccess'

const LEVEL_ORDER: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

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

export async function getUserModuleLevel(userId: string, moduleKey: string): Promise<ModuleLevel | null> {
  const { levels } = await getUserModuleContext(userId)
  const normalizedKey = normalizeModuleKey(moduleKey)
  return levels[normalizedKey] ?? null
}

export async function getUserGroupIds(userId: string): Promise<string[]> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  })

  return memberships.map((m) => m.groupId)
}

export async function canFeature(
  userId: string,
  moduleKey: string,
  featureKey: string,
  action: Action,
  opts?: { groupIds?: string[] },
): Promise<boolean> {
  const normalizedModuleKey = normalizeModuleKey(moduleKey)
  const normalizedFeatureKey = normalizeFeatureKey(featureKey)

  const level = await getUserModuleLevel(userId, normalizedModuleKey)
  if (!level) return false

  const groupIds = opts?.groupIds ?? (await getUserGroupIds(userId))
  const featureGrant = await prisma.featureGrant.findMany({
    where: {
      groupId: { in: groupIds },
      feature: {
        key: { equals: normalizedFeatureKey, mode: 'insensitive' },
        module: { key: { equals: normalizedModuleKey, mode: 'insensitive' } },
      },
    },
    select: { actions: true },
  })

  if (featureGrant.length > 0) {
    return featureGrant.some((grant) => grant.actions.includes(action))
  }

  const fallbackActions = mapLevelToDefaultActions(level)
  return fallbackActions.includes(action)
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
