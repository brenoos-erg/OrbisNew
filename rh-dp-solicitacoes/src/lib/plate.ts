export const mercosulPlateRegex = /^[A-Z]{3}\d[A-Z]\d{2}$/
export const legacyPlateRegex = /^[A-Z]{3}\d{4}$/

export const plateRegex = new RegExp(
  `^(?:${mercosulPlateRegex.source.slice(1, -1)}|${legacyPlateRegex.source.slice(1, -1)})$`,
)

export function isValidPlate(value: string) {
  const normalized = value.trim().toUpperCase()
  return plateRegex.test(normalized)
}

export function normalizePlate(value: string) {
  return value.trim().toUpperCase()
}