const FALLBACK_CODE_PREFIXES = new Set(['PG', 'IT', 'DD', 'COD', 'MAN', 'POL', 'RQ', 'DOCEXT', 'LEG'])

function sanitizeSegment(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, '')
}

export function resolveDocumentCodePrefixFromTypeCode(documentTypeCode?: string | null) {
  const normalized = sanitizeSegment(documentTypeCode ?? '')
  if (!normalized) return ''

  const normalizedWithoutTrailingDot = normalized.replace(/\.+$/, '')
  if (!normalizedWithoutTrailingDot) return ''

  if (normalizedWithoutTrailingDot.includes('.')) return `${normalizedWithoutTrailingDot}.`
  if (FALLBACK_CODE_PREFIXES.has(normalizedWithoutTrailingDot)) return `${normalizedWithoutTrailingDot}.`

  return `${normalizedWithoutTrailingDot}.`
}

export function resolveDocumentCodePrefixFromCode(code: string) {
  const normalizedCode = sanitizeSegment(code)
  if (!normalizedCode) return ''

  const normalizedWithDot = normalizedCode.endsWith('.') ? normalizedCode : `${normalizedCode}.`
  return normalizedWithDot
}

export function enforceDocumentCodePrefix(code: string, requiredPrefix: string) {
  const normalizedPrefix = resolveDocumentCodePrefixFromCode(requiredPrefix)
  const normalizedCode = sanitizeSegment(code)

  if (!normalizedPrefix) return normalizedCode
  if (!normalizedCode) return normalizedPrefix
  if (normalizedCode.startsWith(normalizedPrefix)) return normalizedCode

  const suffixWithoutPrefix = normalizedCode.replace(/^[A-Z0-9_-]+\./, '')
  return `${normalizedPrefix}${suffixWithoutPrefix}`
}

export function extractDocumentCodeSuffix(code: string, requiredPrefix: string) {
  const normalizedPrefix = resolveDocumentCodePrefixFromCode(requiredPrefix)
  const normalizedCode = sanitizeSegment(code)

  if (!normalizedPrefix) return normalizedCode
  if (!normalizedCode.startsWith(normalizedPrefix)) return normalizedCode

  return normalizedCode.slice(normalizedPrefix.length)
}

export function codeMatchesRequiredPrefix(code: string, requiredPrefix: string) {
  const normalizedPrefix = resolveDocumentCodePrefixFromCode(requiredPrefix)
  const normalizedCode = sanitizeSegment(code)

  if (!normalizedPrefix) return true
  return normalizedCode.startsWith(normalizedPrefix)
}