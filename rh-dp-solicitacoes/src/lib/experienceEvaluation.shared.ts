type Dict = Record<string, unknown>

const asRecord = (value: unknown): Dict => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Dict
}

const readString = (obj: Dict, key: string): string => {
  const value = obj[key]
  return typeof value === 'string' ? value.trim() : ''
}

const readAnyString = (obj: Dict, keys: string[]): string => {
  for (const key of keys) {
    const value = readString(obj, key)
    if (value) return value
  }
  return ''
}

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

  return {
    id: readAnyString(merged, ['gestorImediatoAvaliadorId', 'avaliadorId', 'gestorId']),
    login: readAnyString(merged, [
      'gestorImediatoAvaliadorLogin',
      'avaliadorLogin',
      'gestorLogin',
    ]),
    email: readAnyString(merged, [
      'gestorImediatoAvaliadorEmail',
      'avaliadorEmail',
      'gestorEmail',
    ]),
    fullName: readAnyString(merged, ['gestorImediatoAvaliador', 'avaliador', 'gestor']),
  }
}

export function patchExperienceEvaluationEvaluatorFields(
  campos: Record<string, unknown>,
  evaluator: {
    id: string
    fullName?: string | null
    login?: string | null
    email?: string | null
  } | null,
) {
  const normalizedId = String(evaluator?.id ?? '').trim()
  const normalizedName = String(evaluator?.fullName ?? '').trim()
  const normalizedLogin = String(evaluator?.login ?? '').trim()
  const normalizedEmail = String(evaluator?.email ?? '').trim()

  if (!normalizedId) {
    return {
      ...campos,
      gestorImediatoAvaliadorId: '',
      gestorImediatoAvaliador: '',
      gestorImediatoAvaliadorLogin: '',
      gestorImediatoAvaliadorEmail: '',
      avaliadorId: '',
      avaliador: '',
      avaliadorLogin: '',
      avaliadorEmail: '',
      gestorId: '',
      gestor: '',
      gestorLogin: '',
      gestorEmail: '',
    }
  }

  return {
    ...campos,
    gestorImediatoAvaliadorId: normalizedId,
    gestorImediatoAvaliador: normalizedName,
    gestorImediatoAvaliadorLogin: normalizedLogin,
    gestorImediatoAvaliadorEmail: normalizedEmail,
    avaliadorId: normalizedId,
    avaliador: normalizedName,
    avaliadorLogin: normalizedLogin,
    avaliadorEmail: normalizedEmail,
    gestorId: normalizedId,
    gestor: normalizedName,
    gestorLogin: normalizedLogin,
    gestorEmail: normalizedEmail,
  }
}

type EvaluatorIdentity = {
  id: string
  fullName?: string | null
  login?: string | null
  email?: string | null
}

function isObjectRecord(value: unknown): value is Dict {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeEvaluatorValue(value: unknown) {
  return normalize(value)
}

function matchesEvaluatorByIdentity(
  evaluator: EvaluatorIdentity,
  assigned: { id: string; login: string; email: string; fullName: string },
) {
  const evaluatorId = String(evaluator.id ?? '').trim()
  const evaluatorLogin = normalizeEvaluatorValue(evaluator.login)
  const evaluatorEmail = normalizeEvaluatorValue(evaluator.email)
  const evaluatorName = normalizeEvaluatorValue(evaluator.fullName)

  return (
    (assigned.id && evaluatorId && assigned.id === evaluatorId) ||
    (assigned.login && evaluatorLogin && normalizeEvaluatorValue(assigned.login) === evaluatorLogin) ||
    (assigned.email && evaluatorEmail && normalizeEvaluatorValue(assigned.email) === evaluatorEmail) ||
    (assigned.fullName && evaluatorName && normalizeEvaluatorValue(assigned.fullName) === evaluatorName)
  )
}

export function resolveExperienceEvaluationEvaluatorFromDirectory(
  payloadOrCampos: unknown,
  evaluators: EvaluatorIdentity[],
) {
  const payloadRecord = asRecord(payloadOrCampos)
  const likelyCampos = asRecord(payloadRecord.campos)
  const hasPayloadShape = Object.keys(payloadRecord).some((key) =>
    ['campos', 'metadata', 'requestData', 'dynamicForm'].includes(key),
  )
  const sourcePayload = hasPayloadShape ? payloadOrCampos : { campos: likelyCampos }

  const assigned = resolveExperienceEvaluationAssignedEvaluator(sourcePayload)
  const byIdentity = evaluators.find((evaluator) => matchesEvaluatorByIdentity(evaluator, assigned))
  if (byIdentity) return byIdentity
  return null
}

export function patchExperienceEvaluationEvaluatorPayload(
  payload: unknown,
  evaluator: EvaluatorIdentity | null,
) {
  const root = isObjectRecord(payload) ? payload : {}
  const sections: Array<'campos' | 'metadata' | 'requestData' | 'dynamicForm'> = [
    'campos',
    'metadata',
    'requestData',
    'dynamicForm',
  ]

  const result: Dict = { ...root }
  for (const section of sections) {
    const currentSection = isObjectRecord(result[section]) ? (result[section] as Dict) : {}
    result[section] = patchExperienceEvaluationEvaluatorFields(currentSection, evaluator)
  }

  return result
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

  const matchesByAssignedId = Boolean(assigned.id && userId && assigned.id === userId)
  const matchesByAssignedLogin = Boolean(
    assigned.login && userLogin && normalize(assigned.login) === userLogin,
  )
  const matchesByAssignedEmail = Boolean(
    assigned.email && userEmail && normalize(assigned.email) === userEmail,
  )
  const matchesByAssignedName = Boolean(
    assigned.fullName && userFullName && normalize(assigned.fullName) === userFullName,
  )

  if (
    matchesByAssignedId ||
    matchesByAssignedLogin ||
    matchesByAssignedEmail ||
    matchesByAssignedName
  ) {
    return true
  }

  return Boolean(userId) && String(solicitation.approverId ?? '').trim() === userId
}
