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

export function normalizeModules(modules: BasicModule[]): NormalizedModulesResult {
  const byKey = new Map<string, { canonical: BasicModule; allIds: Set<string> }>()

  modules.forEach((mod) => {
    const slugKey = mod.key.toLowerCase()
    const entry = byKey.get(slugKey)

    if (!entry) {
      byKey.set(slugKey, {
        canonical: { ...mod, key: slugKey },
        allIds: new Set([mod.id]),
      })
      return
    }

    entry.allIds.add(mod.id)

    // Preferimos o registro cuja key já está normalizada como canonical
    if (mod.key.toLowerCase() === mod.key) {
      entry.canonical = { ...mod, key: slugKey }
    }
  })

  const normalizedModules = Array.from(byKey.values())
    .map(({ canonical }) => canonical)
    .sort((a, b) => a.name.localeCompare(b.name))

  const keyToId = new Map<string, string>()
  const idToCanonicalId = new Map<string, string>()

  byKey.forEach(({ canonical, allIds }, key) => {
    keyToId.set(key, canonical.id)
    allIds.forEach((id) => idToCanonicalId.set(id, canonical.id))
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