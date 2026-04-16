import { ModuleLevel } from '@prisma/client'

export const SST_MODULE_KEY = 'sst'
const SST_MODULE_ALIASES = ['sgi-qualidade', 'sgi_qualidade', 'sgi/qualidade', 'sgi / qualidade'] as const
const LEVEL_ORDER: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

export function hasMinLevel(level: ModuleLevel | undefined, min: ModuleLevel) {
  if (!level) return false
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(min)
}

export function normalizeSstLevel(levels: Record<string, ModuleLevel | undefined>) {
  return (
    levels[SST_MODULE_KEY] ??
    levels[SST_MODULE_KEY.toUpperCase()] ??
    levels[SST_MODULE_KEY.replace(/-/g, '_')] ??
    SST_MODULE_ALIASES
      .map((key) => levels[key] ?? levels[key.toUpperCase()] ?? levels[key.replace(/\//g, '-')] ?? levels[key.replace(/\//g, '_')])
      .find(Boolean)
  )
}
