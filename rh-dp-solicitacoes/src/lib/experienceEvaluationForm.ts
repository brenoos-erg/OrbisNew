export const EXPERIENCE_EVALUATION_COMPETENCIES = [
  { key: 'relacionamentoNota', label: 'Relacionamento' },
  { key: 'comunicacaoNota', label: 'Comunicação' },
  { key: 'atitudeNota', label: 'Atitude' },
  { key: 'saudeSegurancaNota', label: 'Saúde e Segurança' },
  { key: 'dominioTecnicoProcessosNota', label: 'Domínio Técnico / Processos' },
  { key: 'adaptacaoMudancaNota', label: 'Adaptação, Mobilização e Gestão da Mudança' },
  { key: 'autogestaoGestaoPessoasNota', label: 'Autogestão / Gestão de Pessoas' },
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
    notas,
  }
}