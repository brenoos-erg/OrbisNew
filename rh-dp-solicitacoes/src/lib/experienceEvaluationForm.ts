import { normalizeExperienceEvaluationPayload } from '@/lib/experienceEvaluation.shared'

import {
  EXPERIENCE_EVALUATION_COMMENT_QUESTION,
  EXPERIENCE_EVALUATION_QUESTIONS,
} from '@/lib/experienceEvaluationQuestions'

export const EXPERIENCE_EVALUATION_COMPETENCIES = EXPERIENCE_EVALUATION_QUESTIONS.map((question) => ({
  key: question.field,
  field: question.field,
  label: question.title,
  title: question.title,
  description: question.description,
}))

export {
  EXPERIENCE_EVALUATION_COMMENT_QUESTION,
  EXPERIENCE_EVALUATION_INTRO_TEXT,
  EXPERIENCE_EVALUATION_QUESTIONS,
  EXPERIENCE_EVALUATION_SCORE_OPTIONS,
} from '@/lib/experienceEvaluationQuestions'

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
  const normalized = normalizeExperienceEvaluationPayload(payload)
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
    value: normalized[item.key] || '-',
  }))

  return {
    colaboradorAvaliado: normalized.colaboradorAvaliado,
    cargoColaborador: normalized.cargoColaborador,
    contratoSetor: normalized.contratoSetor,
    gestorImediatoAvaliador: normalized.gestorImediatoAvaliador,
    dataAdmissao: normalized.dataAdmissao,
    cargoAvaliador: normalized.cargoAvaliador,
    comentarioFinal: normalized.comentarioFinal,
    avaliadoEm: normalized.avaliadoEm,
    historicoRelacionado: historyCandidates[0] ?? '',
    notas,
  }
}
