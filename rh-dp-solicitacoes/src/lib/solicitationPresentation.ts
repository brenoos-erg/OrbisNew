type GenericRecord = Record<string, unknown>


const DATE_FIELD_HINTS = [
  'data', 'dt', 'inicio', 'início', 'fim', 'retorno', 'gozo', 'aquisitivo',
  'admissao', 'admissão', 'desligamento', 'nascimento', 'vencimento',
]

const NON_DATE_FIELD_HINTS = [
  'cbo', 'matricula', 'matrícula', 'protocolo', 'telefone', 'phone', 'ramal',
]

function shouldFormatDateField(fieldName?: string) {
  if (!fieldName) return true
  const normalized = fieldName.toLowerCase()
  if (NON_DATE_FIELD_HINTS.some((hint) => normalized.includes(hint))) return false
  return DATE_FIELD_HINTS.some((hint) => normalized.includes(hint))
}

export function formatDateStringForDisplay(value: string, fieldName?: string) {
  const trimmed = value.trim()
  if (!trimmed || !shouldFormatDateField(fieldName)) return null

  const pureDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (pureDateMatch) {
    const [, yyyy, mm, dd] = pureDateMatch
    return `${dd}/${mm}/${yyyy}`
  }

  const isoDateTimeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})?$/)
  if (isoDateTimeMatch) {
    const [, yyyy, mm, dd, hh, min] = isoDateTimeMatch
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`
  }

  return null
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isTruthyBooleanValue(value: unknown) {
  return toBoolean(value) === true
}

export function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return null
}

export function formatBooleanForDisplay(value: unknown, fieldName?: string) {
  const parsed = toBoolean(value)
  if (parsed === null) return null

  const normalizedFieldName = (fieldName ?? '').toLowerCase()
  if (normalizedFieldName.includes('escritoriofilial')) {
    return parsed ? 'Filial' : 'Matriz'
  }

  return parsed ? 'Sim' : 'Não'
}

export function formatDisplayValueForUser(value: unknown, fieldName?: string) {
  const booleanLabel = formatBooleanForDisplay(value, fieldName)
  if (booleanLabel !== null) return booleanLabel
  if (Array.isArray(value)) {
    return value
      .map((item) => (item === null || item === undefined ? '' : String(item).trim()))
      .filter(Boolean)
      .join(', ')
  }
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return formatDateStringForDisplay(value, fieldName) ?? value
  return String(value)
}

function looksTechnicalCostCenterId(value: string) {
  return UUID_REGEX.test(value) || /^[a-f0-9]{24,}$/i.test(value)
}

export function resolveFriendlyCostCenterValue(
  key: string,
  payloadCampos: GenericRecord,
  fallbackLabel?: string,
) {
  const rawValue = payloadCampos[key]
  if (rawValue === undefined || rawValue === null) return fallbackLabel || ''
  const rawAsString = String(rawValue).trim()
  if (!rawAsString) return fallbackLabel || ''

  const normalizedBaseKey = key.replace(/(id|uuid)$/i, '')
  const candidateKeys = [
    `${key}Label`,
    `${key}Text`,
    `${normalizedBaseKey}Label`,
    `${normalizedBaseKey}Text`,
    'centroCustoDestinoText',
    'centroCustoDestinoIdLabel',
    'centroCustoIdLabel',
    'centroCustoLabel',
    'costCenterText',
    'costCenterLabel',
  ]

  for (const candidateKey of candidateKeys) {
    const candidateValue = payloadCampos[candidateKey]
    if (typeof candidateValue === 'string' && candidateValue.trim()) {
      return candidateValue.trim()
    }
  }

  if (looksTechnicalCostCenterId(rawAsString)) {
    return fallbackLabel || ''
  }

  return rawAsString
}

export function normalizeFieldLabel(label: string, key: string) {
  const source = (label || key).trim()
  const normalizedKey = key.toLowerCase()
  const normalizedSource = source.toLowerCase()

  if (
    normalizedKey.includes('centrocusto') ||
    normalizedKey.includes('costcenter') ||
    normalizedSource.includes('centro custo') ||
    normalizedSource.includes('cost center')
  ) {
    return 'Centro de custo'
  }

  if (normalizedSource === 'escritorio filial' || normalizedKey.includes('escritoriofilial')) {
    return 'Unidade'
  }

  return source
}
