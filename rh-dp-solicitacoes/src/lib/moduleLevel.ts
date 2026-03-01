import type { ModuleLevel } from '@prisma/client'

export const MODULE_LEVEL_ORDER: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

export function isModuleLevelAtLeast(level: ModuleLevel, minLevel: ModuleLevel) {
  const userIndex = MODULE_LEVEL_ORDER.indexOf(level)
  const minIndex = MODULE_LEVEL_ORDER.indexOf(minLevel)

  if (userIndex < 0 || minIndex < 0) {
    return false
  }

  return userIndex >= minIndex
}