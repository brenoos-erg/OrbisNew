type Dict = Record<string, unknown>

export type NormalizedExperienceEvaluationPayload = {
  colaboradorAvaliado: string
  contratoSetor: string
  gestorImediatoAvaliador: string
  cargoColaborador: string
  dataAdmissao: string
  cargoAvaliador: string
  relacionamentoNota: string
  comunicacaoNota: string
  atitudeNota: string
  saudeSegurancaNota: string
  dominioTecnicoProcessosNota: string
  adaptacaoMudancaNota: string
  autogestaoGestaoPessoasNota: string
  comentarioFinal: string
  avaliadoEm: string
}

const EXPERIENCE_EVALUATION_NORMALIZED_KEYS = [
  'colaboradorAvaliado',
  'contratoSetor',
  'gestorImediatoAvaliador',
  'cargoColaborador',
  'dataAdmissao',
  'cargoAvaliador',
  'relacionamentoNota',
  'comunicacaoNota',
  'atitudeNota',
  'saudeSegurancaNota',
  'dominioTecnicoProcessosNota',
  'adaptacaoMudancaNota',
  'autogestaoGestaoPessoasNota',
  'comentarioFinal',
  'avaliadoEm',
] as const

type ExperienceEvaluationNormalizedKey = (typeof EXPERIENCE_EVALUATION_NORMALIZED_KEYS)[number]

function readDisplayString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(readDisplayString).filter(Boolean).join(', ')
  return ''
}

function parsePayloadRoot(payload: unknown): Dict {
  if (typeof payload === 'string') {
    try {
      return asRecord(JSON.parse(payload))
    } catch {
      return {}
    }
  }
  return asRecord(payload)
}

function isBlankDisplayValue(value: string) {
  return value.trim().length === 0
}

function withFallback(value: string) {
  return isBlankDisplayValue(value) ? '-' : value
}

function firstStringFromSources(sources: Dict[], keys: string[]) {
  for (const source of sources) {
    for (const key of keys) {
      const value = readDisplayString(source[key])
      if (value) return value
    }
  }
  return ''
}

export function normalizeExperienceEvaluationPayload(
  payload: unknown,
): NormalizedExperienceEvaluationPayload {
  const root = parsePayloadRoot(payload)
  const campos = asRecord(root.campos)
  const formData = asRecord(root.formData)
  const dadosFormulario = asRecord(root.dadosFormulario)
  const form = asRecord(root.form)
  const formulario = asRecord(root.formulario)
  const metadata = asRecord(root.metadata)
  const requestData = asRecord(root.requestData)
  const dynamicForm = asRecord(root.dynamicForm)
  const answers = asRecord(root.answers)
  const respostas = asRecord(root.respostas)
  const fields = asRecord(root.fields)
  const avaliacao = asRecord(root.avaliacao)
  const avaliacaoGestor = asRecord(root.avaliacaoGestor)

  const baseSources = [
    campos,
    formData,
    dadosFormulario,
    formulario,
    form,
    fields,
    answers,
    respostas,
    avaliacao,
    dynamicForm,
    requestData,
    metadata,
    root,
  ]
  const evaluationSources = [avaliacaoGestor, avaliacao, respostas, ...baseSources]

  const result = {} as NormalizedExperienceEvaluationPayload
  const directKeys: Record<ExperienceEvaluationNormalizedKey, string[]> = {
    colaboradorAvaliado: ['colaboradorAvaliado', 'colaborador', 'nomeColaborador'],
    contratoSetor: ['contratoSetor', 'setorContrato', 'setor', 'departmentName'],
    gestorImediatoAvaliador: [
      'gestorImediatoAvaliador',
      'gestorImediato',
      'avaliador',
      'gestor',
      'leaderName',
    ],
    cargoColaborador: ['cargoColaborador', 'cargo', 'positionName'],
    dataAdmissao: ['dataAdmissao', 'admissaoData', 'dataAdmissaoPrevista'],
    cargoAvaliador: ['cargoAvaliador', 'cargoGestor', 'cargoAvaliadorGestor'],
    relacionamentoNota: ['relacionamentoNota', 'relacionamento', 'notaRelacionamento'],
    comunicacaoNota: ['comunicacaoNota', 'comunicacao', 'notaComunicacao'],
    atitudeNota: ['atitudeNota', 'atitude', 'notaAtitude'],
    saudeSegurancaNota: ['saudeSegurancaNota', 'saudeSeguranca', 'notaSaudeSeguranca'],
    dominioTecnicoProcessosNota: ['dominioTecnicoProcessosNota', 'dominioTecnicoProcessos', 'notaDominioTecnicoProcessos'],
    adaptacaoMudancaNota: ['adaptacaoMudancaNota', 'adaptacaoMudanca', 'notaAdaptacaoMudanca'],
    autogestaoGestaoPessoasNota: ['autogestaoGestaoPessoasNota', 'autogestaoGestaoPessoas', 'notaAutogestaoGestaoPessoas'],
    comentarioFinal: ['comentarioFinal', 'comentarios', 'observacoes', 'parecerFinal'],
    avaliadoEm: ['avaliadoEm', 'dataAvaliacao', 'avaliacaoEm', 'finalizadoEm', 'dataFinalizacao'],
  }

  for (const key of EXPERIENCE_EVALUATION_NORMALIZED_KEYS) {
    const sources = key.endsWith('Nota') || key === 'comentarioFinal' ? evaluationSources : baseSources
    result[key] = withFallback(firstStringFromSources(sources, directKeys[key]))
  }

  if (result.gestorImediatoAvaliador === '-') {
    result.gestorImediatoAvaliador = withFallback(firstStringFromSources(baseSources, [
      'gestorImediatoAvaliadorId',
      'avaliadorId',
      'gestorId',
    ]))
  }

  return result
}

export function hasExperienceEvaluationPrintableData(payload: unknown) {
  const normalized = normalizeExperienceEvaluationPayload(payload)
  return [
    normalized.relacionamentoNota,
    normalized.comunicacaoNota,
    normalized.atitudeNota,
    normalized.saudeSegurancaNota,
    normalized.dominioTecnicoProcessosNota,
    normalized.adaptacaoMudancaNota,
    normalized.autogestaoGestaoPessoasNota,
    normalized.comentarioFinal,
  ].some((value) => value.trim().length > 0 && value !== '-')
}


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
  const userId = String(user.id ?? '').trim()
  const canonicalApproverId = String(solicitation.approverId ?? '').trim()

  if (canonicalApproverId) {
    return Boolean(userId) && canonicalApproverId === userId
  }

  const assigned = resolveExperienceEvaluationAssignedEvaluator(solicitation.payload)
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

  return false
}
