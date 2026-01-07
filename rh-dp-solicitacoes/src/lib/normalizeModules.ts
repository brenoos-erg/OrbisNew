// Utilitário para normalizar módulos duplicados
// Mantém apenas uma ocorrência por "key" (case-insensitive) e retorna
// mapas auxiliares para reescrever vínculos.

export type BasicModule = { id: string; key: string; name: string }
export type ModuleLink = { departmentId: string; moduleId: string }

export type NormalizedModulesResult = {
  modules: BasicModule[]
  keyToId: Map<string, string>
  idToCanonicalId: Map<string, string>
}
function toSlugKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[^\p{ASCII}]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export function normalizeModuleKey(value: string) {
  return toSlugKey(value)
}


export function normalizeModules(modules: BasicModule[]): NormalizedModulesResult {
  const byKey = new Map<string, { canonical: BasicModule; allIds: Set<string> }>()
   const aliasByName = new Map<string, string>()

  modules.forEach((mod) => {
    const slugKey = toSlugKey(mod.key || mod.name)
     const slugName = toSlugKey(mod.name)

    const canonicalKey = byKey.has(slugKey)
      ? slugKey
      : aliasByName.get(slugName) || slugKey

    const entry = byKey.get(canonicalKey)

    if (!entry) {
      byKey.set(canonicalKey, {
        canonical: { ...mod, key: canonicalKey },
        allIds: new Set([mod.id]),
      })
      aliasByName.set(slugName, canonicalKey)
      aliasByName.set(slugKey, canonicalKey)
      return
    }

    entry.allIds.add(mod.id)
    aliasByName.set(slugName, canonicalKey)
    aliasByName.set(slugKey, canonicalKey)

    // Preferimos o registro cuja key já está normalizada como canonical
    if (toSlugKey(mod.key) === mod.key.toLowerCase()) {
      entry.canonical = { ...mod, key: canonicalKey }
    }
  })

  const normalizedModules = Array.from(byKey.values())
    .map(({ canonical }) => canonical)
    .sort((a, b) => a.name.localeCompare(b.name))

  const keyToId = new Map<string, string>()
  const idToCanonicalId = new Map<string, string>()

  byKey.forEach(({ canonical, allIds }, key) => {
    keyToId.set(key, canonical.id)
    keyToId.set(toSlugKey(canonical.name), canonical.id)

    allIds.forEach((id) => idToCanonicalId.set(id, canonical.id))
  })

  aliasByName.forEach((canonicalKey, alias) => {
    const canonical = byKey.get(canonicalKey)
    if (!canonical) return
    keyToId.set(alias, canonical.canonical.id)
  })
  return { modules: normalizedModules, keyToId, idToCanonicalId }
}

export function normalizeModuleLinks(
  links: ModuleLink[],
  idToCanonicalId: Map<string, string>,
): ModuleLink[] {
  const normalizedLinks: ModuleLink[] = []

  links.forEach((link) => {
    const canonicalId = idToCanonicalId.get(link.moduleId)
    if (!canonicalId) return

    const alreadyInserted = normalizedLinks.some(
      (l) => l.departmentId === link.departmentId && l.moduleId === canonicalId,
    )

    if (!alreadyInserted) {
      normalizedLinks.push({ departmentId: link.departmentId, moduleId: canonicalId })
    }
  })

  return normalizedLinks
}