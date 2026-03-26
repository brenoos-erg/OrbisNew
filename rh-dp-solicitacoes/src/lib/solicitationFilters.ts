type DateRangeInput = {
  start?: string | null
  end?: string | null
}

function parseDateBoundary(value: string, boundary: 'start' | 'end') {
  const trimmed = value.trim()
  if (!trimmed) return null
  const suffix = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'
  const date = new Date(`${trimmed}${suffix}`)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function buildUtcDateRangeFilter(input: DateRangeInput) {
  const gte = input.start ? parseDateBoundary(input.start, 'start') : null
  const lte = input.end ? parseDateBoundary(input.end, 'end') : null
  if (!gte && !lte) return undefined

  return {
    ...(gte ? { gte } : {}),
    ...(lte ? { lte } : {}),
  }
}

export function normalizeFilterText(value: string | null | undefined) {
  if (!value) return ''
  return value.trim()
}