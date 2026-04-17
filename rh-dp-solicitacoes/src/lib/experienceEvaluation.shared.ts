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
