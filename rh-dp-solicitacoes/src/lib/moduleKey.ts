type ModuleKeyAliasGroup = {
  canonical: string
  aliases: string[]
}

const MODULE_KEY_ALIAS_GROUPS: ModuleKeyAliasGroup[] = [
  {
    canonical: 'gestao-de-frotas',
    aliases: ['gestao_frotas'],
  },
  {
    canonical: 'direito-de-recusa',
    aliases: ['direito_de_recusa'],
  },
  {
    canonical: 'controle-equipamentos-ti',
    aliases: ['controle_equipamentos_ti'],
  },
]

const MODULE_KEY_ALIAS_MAP = new Map<string, string>()
const MODULE_KEY_ALIAS_LIST = new Map<string, string[]>()

for (const group of MODULE_KEY_ALIAS_GROUPS) {
  const canonical = group.canonical
  const normalizedAliases = new Set<string>([
    canonical,
    canonical.replace(/-/g, '_'),
    ...group.aliases,
  ])

  for (const alias of normalizedAliases) {
    MODULE_KEY_ALIAS_MAP.set(alias, canonical)
  }

  MODULE_KEY_ALIAS_LIST.set(canonical, Array.from(normalizedAliases))
}

export function normalizeModuleKey(moduleKey: string) {
  const raw = moduleKey.trim().toLowerCase()
  const normalized = raw.replace(/_/g, '-')
  return MODULE_KEY_ALIAS_MAP.get(raw) ?? MODULE_KEY_ALIAS_MAP.get(normalized) ?? normalized
}

export function getModuleKeyAliases(moduleKey: string) {
  const normalized = normalizeModuleKey(moduleKey)
  const aliases = new Set<string>([normalized])

  aliases.add(moduleKey.trim().toLowerCase())
  aliases.add(normalized.replace(/-/g, '_'))
  aliases.add(normalized.replace(/_/g, '-'))

  const explicitAliases = MODULE_KEY_ALIAS_LIST.get(normalized)
  if (explicitAliases) {
    for (const alias of explicitAliases) {
      aliases.add(alias)
    }
  }

  return Array.from(aliases)
}