type Dict = Record<string, unknown>

const asRecord = (value: unknown): Dict => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Dict
}

const readString = (obj: Dict, key: string): string => {
  const value = obj[key]
  return typeof value === 'string' ? value.trim() : ''
}

const hasOwn = (obj: Dict, key: string) => Object.prototype.hasOwnProperty.call(obj, key)

const normalize = (value: unknown) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')

export function resolveExperienceEvaluationAssignedEvaluator(payload: unknown) {
  const root = asRecord(payload)
  const campos = asRecord(root.campos)
  const metadata = asRecord(root.metadata)
  const requestData = asRecord(root.requestData)
  const dynamicForm = asRecord(root.dynamicForm)

  const merged = {
    ...requestData,
    ...metadata,
    ...dynamicForm,
    ...campos,
  }

  const dedicatedEvaluatorFieldsPresent =
    hasOwn(merged, 'gestorImediatoAvaliadorId') ||
    hasOwn(merged, 'gestorImediatoAvaliadorLogin') ||
    hasOwn(merged, 'gestorImediatoAvaliadorEmail') ||
    hasOwn(merged, 'gestorImediatoAvaliador')

  const dedicatedEvaluator = {
    id: readString(merged, 'gestorImediatoAvaliadorId'),
    login: readString(merged, 'gestorImediatoAvaliadorLogin'),
    email: readString(merged, 'gestorImediatoAvaliadorEmail'),
    fullName: readString(merged, 'gestorImediatoAvaliador'),
  }

  if (dedicatedEvaluatorFieldsPresent) return dedicatedEvaluator

  return {
    id: readString(merged, 'avaliadorId') || readString(merged, 'gestorId'),
    login: readString(merged, 'avaliadorLogin') || readString(merged, 'gestorLogin'),
    email: readString(merged, 'avaliadorEmail') || readString(merged, 'gestorEmail'),
    fullName: readString(merged, 'avaliador') || readString(merged, 'gestor'),
  }
}

export function isExperienceEvaluationEvaluator(
  solicitation: { payload?: unknown; approverId?: string | null },
  user: {
    id?: string | null
    login?: string | null
    email?: string | null
    fullName?: string | null
  },
) {
  const assigned = resolveExperienceEvaluationAssignedEvaluator(solicitation.payload)
  const userId = String(user.id ?? '').trim()
  const userLogin = normalize(user.login)
  const userEmail = normalize(user.email)
  const userFullName = normalize(user.fullName)

  if (assigned.id) return assigned.id === userId
  if (assigned.login) return normalize(assigned.login) === userLogin
  if (assigned.email) return normalize(assigned.email) === userEmail
  if (assigned.fullName) return normalize(assigned.fullName) === userFullName

  return Boolean(userId) && String(solicitation.approverId ?? '').trim() === userId
}
