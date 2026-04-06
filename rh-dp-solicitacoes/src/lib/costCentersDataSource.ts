export type CostCenterSelectOption = {
  id: string
  code?: string | null
  description?: string | null
  externalCode?: string | null
}

export type CostCenterResponse<T> = T[] | { items?: T[] }

export const OFFICIAL_COST_CENTER_PAGE_SIZE = 200

export function normalizeCostCenters<T>(data: CostCenterResponse<T>): T[] {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  return []
}

export async function fetchOfficialCostCenters<T extends CostCenterSelectOption>(): Promise<T[]> {
  const selectResponse = await fetch('/api/cost-centers/select', {
    cache: 'no-store',
  })

  if (selectResponse.ok) {
    const data = (await selectResponse.json()) as CostCenterResponse<T>
    const normalized = normalizeCostCenters(data)
    if (normalized.length > 0) return normalized
  }

  const aggregated: T[] = []
  let page = 1

  while (true) {
    const fallbackResponse = await fetch(
      `/api/cost-centers?pageSize=${OFFICIAL_COST_CENTER_PAGE_SIZE}&page=${page}`,
      { cache: 'no-store' },
    )

    if (!fallbackResponse.ok) return []

    const fallbackData = (await fallbackResponse.json()) as CostCenterResponse<T>
    const pageItems = normalizeCostCenters(fallbackData)
    aggregated.push(...pageItems)

    if (pageItems.length < OFFICIAL_COST_CENTER_PAGE_SIZE) break
    page += 1
  }

  return aggregated
}