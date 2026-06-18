import { isSolicitacaoManutencaoTi } from '@/lib/solicitationTypes'

type FieldDef = {
  name?: string
  key?: string
  field?: string
  label?: string
  required?: boolean
  obrigatorio?: boolean
  type?: string
  tipo?: string
  options?: string[]
  opcoes?: string[]
}
type Tipo = { codigo?: string | null; nome?: string | null; schemaJson?: unknown }
export class SolicitationPayloadValidationError extends Error { status = 400 }
function fail(message: string): never { throw new SolicitationPayloadValidationError(message) }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }
function getFieldName(field: FieldDef) { return field.name ?? field.key ?? field.field }
function isRequired(field: FieldDef) { return field.required === true || field.obrigatorio === true }
function getFieldType(field: FieldDef) { return field.type ?? field.tipo }
function getOptions(field: FieldDef) { return field.options ?? field.opcoes }
function readPayloadValue(payload: Record<string, unknown>, fieldName: string) {
  const campos = isRecord(payload.campos) ? payload.campos : {}
  if (Object.prototype.hasOwnProperty.call(campos, fieldName)) return campos[fieldName]
  return payload[fieldName]
}
function collectFieldDefs(schemaJson: unknown): FieldDef[] {
  if (!isRecord(schemaJson)) return []
  return ['fields', 'campos', 'camposEspecificos'].flatMap((key) => {
    const value = schemaJson[key]
    return Array.isArray(value) ? value.filter(isRecord) as FieldDef[] : []
  })
}
function isBlank(value: unknown) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

export function validateSolicitationPayload(tipo: Tipo, payloadInput: unknown) {
  const payload = isRecord(payloadInput) ? payloadInput : {}
  const fields = collectFieldDefs(tipo.schemaJson)

  for (const field of fields) {
    const fieldName = getFieldName(field)
    if (!fieldName) continue
    const current = readPayloadValue(payload, fieldName)
    const label = field.label ?? fieldName
    if (isRequired(field) && isBlank(current)) fail(`Campo obrigatório ausente: ${label}`)
    const options = getOptions(field)
    if (!isBlank(current) && options?.length && !options.includes(String(current))) fail(`Opção inválida para ${label}.`)
    const type = getFieldType(field)
    if (!isBlank(current) && type === 'date' && Number.isNaN(Date.parse(String(current)))) fail(`Data inválida em ${label}.`)
  }

  const campos = isRecord(payload.campos) ? payload.campos : {}
  const read = (key: string) => readPayloadValue(payload, key)
  if (isSolicitacaoManutencaoTi(tipo)) {
    if (!read('itemManutencao')) fail('Selecione se a manutenção é para equipamento ou sistema.')
    if (read('itemManutencao') === 'Sistema' && !String(read('nomeSistemaManutencao') ?? '').trim()) fail('Informe o sistema da manutenção.')
    if (read('itemManutencao') === 'Equipamento' && !String(read('tipoEquipamentoManutencao') ?? '').trim()) fail('Selecione o tipo de equipamento para a manutenção.')
  }
  return { ok: true as const, payload: { ...payload, campos } }
}
