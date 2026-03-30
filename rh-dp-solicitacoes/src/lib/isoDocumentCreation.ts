export function resolveInitialRevisionNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(parsed)) return 0
  if (!Number.isInteger(parsed)) return 0
  if (parsed < 0) return 0
  return parsed
}