export type CostCenterLabelInput = {
  description?: string | null
  externalCode?: string | null
  code?: string | null
}

export function formatCostCenterLabel(
  costCenter?: CostCenterLabelInput | null,
  fallback = '—',
) {
  if (!costCenter) return fallback

  const description = costCenter.description?.trim() ?? ''
  const code = (costCenter.externalCode ?? costCenter.code ?? '').trim()

  if (!description && !code) return fallback
  if (description && code) return `${code} - ${description}`
  return description || code
}