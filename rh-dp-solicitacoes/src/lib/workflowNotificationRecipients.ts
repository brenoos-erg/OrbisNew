import type { ModuleLevel } from '@prisma/client'
import { normalizeModuleKey } from '@/lib/moduleKey'
import { isModuleLevelAtLeast } from '@/lib/moduleLevel'

type ModuleAccessLike = {
  level: ModuleLevel
  module: { key: string }
}

export function hasRequiredWorkflowNotificationAccess(
  userAccess: ModuleAccessLike[],
  moduleKey: string,
  minLevel: ModuleLevel,
) {
  const normalizedTargetKey = normalizeModuleKey(moduleKey)

  return userAccess.some((access) => {
    const normalizedAccessKey = normalizeModuleKey(access.module.key)
    return normalizedAccessKey === normalizedTargetKey && isModuleLevelAtLeast(access.level, minLevel)
  })
}