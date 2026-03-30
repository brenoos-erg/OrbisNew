export function resolveInitialRevisionNumber(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  if (!Number.isInteger(value)) return 0
  if (value < 0) return 0
  return value
}