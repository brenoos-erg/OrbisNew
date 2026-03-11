export function formatDateDDMMYYYY(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '-'
    const yyyy = String(value.getFullYear())
    const mm = String(value.getMonth() + 1).padStart(2, '0')
    const dd = String(value.getDate()).padStart(2, '0')
    return `${dd}-${mm}-${yyyy}`
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    if (!normalized) return '-'

    if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
      const yyyy = normalized.slice(0, 4)
      const mm = normalized.slice(5, 7)
      const dd = normalized.slice(8, 10)
      return `${dd}-${mm}-${yyyy}`
    }

    const parsed = new Date(normalized)
    if (!Number.isNaN(parsed.getTime())) {
      const yyyy = String(parsed.getFullYear())
      const mm = String(parsed.getMonth() + 1).padStart(2, '0')
      const dd = String(parsed.getDate()).padStart(2, '0')
      return `${dd}-${mm}-${yyyy}`
    }
  }

  return '-'
}

export function formatDateTimeDDMMYYYYHHMM(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'

  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return '-'

  const yyyy = String(date.getFullYear())
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')

  return `${dd}-${mm}-${yyyy} ${hh}:${min}`
}