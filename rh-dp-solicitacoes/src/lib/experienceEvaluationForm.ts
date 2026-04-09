export const EXPERIENCE_EVALUATION_COMPETENCIES = [
  {
    key: 'relacionamentoNota',
    label: 'RELACIONAMENTO',
    description:
      'Relaciona-se bem com os colaboradores de forma igualitária, respeitando individualidades e cultivando parcerias / Em cargos de gestão, o colaborador também deve ser exemplo, estimulando bom relacionamento interpessoal para sua equipe e cultivando parcerias com clientes e fornecedores.',
  },
  {
    key: 'comunicacaoNota',
    label: 'COMUNICAÇÃO',
    description:
      'Fala de forma adequada a cada situação e mostra-se aberto para dar e/ou receber feedbacks (retornos) sobre o desempenho. Equilibra a fala e a escuta, ouvindo de maneira desarmada.',
  },
  {
    key: 'atitudeNota',
    label: 'ATITUDE',
    description:
      'proativo, antecipando-se as demandas e demonstrando pontualidade e assertividade no trabalho / Em cargos de gestão, o colaborador também deve ter planejamento estratégico, sabendo classificar urgências, apresentando comprometimento com seus processos e assumindo responsabilidades',
  },
  {
    key: 'saudeSegurancaNota',
    label: 'SAÚDE E SEGURANÇA',
    description:
      'Respeita as normas de saúde e segurança, não se expõe a riscos e conscientiza os outros a respeito de sua importância.',
  },
  {
    key: 'dominioTecnicoProcessosNota',
    label: 'DOMÍNIO TÉCNICO / PROCESSOS',
    description:
      'Possui domínio técnico de suas atividades, apresentando boas entregas e com o mínimo possível de erros / Em cargos de gestão, o colaborador também deve possuir habilidades de gerir os processos que conduz de maneira estratégica, cumprindo metas com a qualidade esperada, respeitando as normas e procedimentos e trazendo os resultados esperados.',
  },
  {
    key: 'adaptacaoMudancaNota',
    label: 'ADAPTAÇÃO, MOBILIZAÇÃO E GESTÃO DA MUDANÇA',
    description:
      'Consegue se adaptar às mudanças e não demonstra resistência / Em cargos de gestão, o colaborador também deve apresentar habilidades de conduzir sua equipe e recursos à um novo fim com assertividade, apresentando os benefícios dessa e demonstrando segurança/confiança para sua equipe.',
  },
  {
    key: 'autogestaoGestaoPessoasNota',
    label: 'AUTOGESTÃO / GESTÃO DE PESSOAS',
    description:
      'Consegue realizar suas atividades de forma autônoma, quando necessário, demonstrando foco e planejamento, entregando suas atividades sem atrasos e buscando autodesenvolvimento / Em cargos de gestão, também deve apresentar habilidades de conduzir sua equipe para alcançar objetivos, estabelecendo metas, potencializando talentos e trabalhando pontos negativos.',
  },
] as const

type Dict = Record<string, unknown>

const asRecord = (value: unknown): Dict => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Dict
}

const readString = (obj: Dict, key: string): string => {
  const value = obj[key]
  return typeof value === 'string' ? value : ''
}

export function isExperienceEvaluationTipo(tipo?: { id?: string | null; codigo?: string | null; nome?: string | null } | null) {
  const id = (tipo?.id ?? '').trim().toUpperCase()
  const codigo = (tipo?.codigo ?? '').trim().toUpperCase()
  const nome = (tipo?.nome ?? '').trim().toUpperCase()
  return id === 'RQ_RH_103' || codigo === 'RQ.RH.103' || nome.includes('AVALIAÇÃO DO PERÍODO DE EXPERIÊNCIA')
}

export function extractExperienceEvaluationData(payload: unknown) {
  const payloadObj = asRecord(payload)
  const campos = asRecord(payloadObj.campos)
  const form = asRecord(payloadObj.form)
  const formulario = asRecord(payloadObj.formulario)
  const metadata = asRecord(payloadObj.metadata)
  const requestData = asRecord(payloadObj.requestData)
  const dynamicForm = asRecord(payloadObj.dynamicForm)
  const answers = asRecord(payloadObj.answers)
  const fields = asRecord(payloadObj.fields)
  const avaliacaoGestor = asRecord(payloadObj.avaliacaoGestor)

  const merged = {
    ...requestData,
    ...metadata,
    ...dynamicForm,
    ...formulario,
    ...form,
    ...fields,
    ...answers,
    ...campos,
    ...avaliacaoGestor,
  }

  const historyCandidates = [
    readString(merged, 'historicoRelacionado'),
    readString(merged, 'historico'),
    readString(merged, 'historicoAvaliacao'),
    readString(merged, 'relacionadoHistorico'),
  ].filter((value) => value.trim().length > 0)

  const notas = EXPERIENCE_EVALUATION_COMPETENCIES.map((item) => ({
    ...item,
    value: readString(merged, item.key) || '-',
  }))


 return {
    colaboradorAvaliado: readString(merged, 'colaboradorAvaliado'),
    cargoColaborador: readString(merged, 'cargoColaborador'),
    contratoSetor: readString(merged, 'contratoSetor'),
    gestorImediatoAvaliador: readString(merged, 'gestorImediatoAvaliador'),
    cargoAvaliador: readString(merged, 'cargoAvaliador'),
    comentarioFinal:
      readString(merged, 'comentarioFinal') ||
      readString(merged, 'comentarios') ||
      readString(merged, 'observacoes'),
    historicoRelacionado: historyCandidates[0] ?? '',
    notas,
  }
}