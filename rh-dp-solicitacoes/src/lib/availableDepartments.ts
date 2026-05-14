export type DepartmentOption = {
  id: string
  label?: string | null
  name?: string | null
  description?: string | null
}

type TipoMetaLike = {
  departamentos?: unknown
  departmentIds?: unknown
  departmentId?: unknown
  hiddenFromCreate?: boolean
  internalOnly?: boolean
  hiddenFromManualOpening?: boolean
}

export type SolicitationTypeDepartmentLinkLike = {
  active?: boolean
  enabled?: boolean
  meta?: TipoMetaLike | null
  schemaJson?: {
    meta?: TipoMetaLike | null
  } | null
  departments?: unknown
  departmentIds?: unknown
  departmentId?: unknown
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const pushStringValue = (value: unknown, target: string[]) => {
  if (typeof value === 'string' && value.trim()) {
    target.push(value.trim())
  }
}

const pushStringArrayValues = (value: unknown, target: string[]) => {
  if (!Array.isArray(value)) return

  for (const item of value) {
    if (typeof item === 'string') {
      pushStringValue(item, target)
      continue
    }

    if (item && typeof item === 'object' && 'id' in item) {
      pushStringValue((item as { id?: unknown }).id, target)
    }
  }
}

export function getDepartmentDisplayLabel(department: DepartmentOption) {
  const label = department.label ?? department.name ?? department.description ?? ''

  return normalizeText(label) === 'logistica' ? 'Logística/Almoxarifado' : label
}

export function isSolicitationTypeAvailableForManualOpening(
  tipo: SolicitationTypeDepartmentLinkLike,
) {
  const meta = tipo.meta ?? tipo.schemaJson?.meta ?? null

  return (
    tipo.active !== false &&
    tipo.enabled !== false &&
    meta?.hiddenFromCreate !== true &&
    meta?.internalOnly !== true &&
    meta?.hiddenFromManualOpening !== true
  )
}

export function getLinkedDepartmentIdsFromSolicitationType(
  tipo: SolicitationTypeDepartmentLinkLike,
) {
  const departmentIds: string[] = []
  const meta = tipo.meta ?? tipo.schemaJson?.meta ?? null

  pushStringArrayValues(meta?.departamentos, departmentIds)
  pushStringArrayValues(tipo.schemaJson?.meta?.departamentos, departmentIds)
  pushStringArrayValues(meta?.departmentIds, departmentIds)
  pushStringArrayValues(tipo.schemaJson?.meta?.departmentIds, departmentIds)
  pushStringValue(meta?.departmentId, departmentIds)
  pushStringValue(tipo.schemaJson?.meta?.departmentId, departmentIds)
  pushStringArrayValues(tipo.departments, departmentIds)
  pushStringArrayValues(tipo.departmentIds, departmentIds)
  pushStringValue(tipo.departmentId, departmentIds)

  return Array.from(new Set(departmentIds))
}

export function getDepartmentsWithAvailableSolicitationTypes<
  TDepartment extends DepartmentOption,
>(departments: TDepartment[], tipos: SolicitationTypeDepartmentLinkLike[]) {
  const validDepartmentIds = new Set(departments.map((department) => department.id))
  const departmentsWithTypes = new Set<string>()

  for (const tipo of tipos) {
    if (!isSolicitationTypeAvailableForManualOpening(tipo)) continue

    for (const departmentId of getLinkedDepartmentIdsFromSolicitationType(tipo)) {
      if (validDepartmentIds.has(departmentId)) {
        departmentsWithTypes.add(departmentId)
      }
    }
  }

  return departments.filter((department) => departmentsWithTypes.has(department.id))
}
