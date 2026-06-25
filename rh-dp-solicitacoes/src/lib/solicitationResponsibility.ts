import { EXPERIENCE_EVALUATION_FINALIZATION_STATUS } from './experienceEvaluation.constants'
import { isExperienceEvaluationTipo } from './experienceEvaluationForm'

type PersonRef = {
  id?: string | null
  fullName?: string | null
}

function readPayloadCampos(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {}
  const root = payload as Record<string, unknown>
  const campos = root.campos
  return campos && typeof campos === 'object' ? (campos as Record<string, unknown>) : root
}

function readFirstText(payload: unknown, keys: string[]) {
  const campos = readPayloadCampos(payload)
  for (const key of keys) {
    const value = campos[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function readFirstId(payload: unknown, keys: string[]) {
  const campos = readPayloadCampos(payload)
  for (const key of keys) {
    const value = campos[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

type SolicitationTypeRef = {
  id?: string | null
  codigo?: string | null
  nome?: string | null
}

export function shouldUseApproverAsPrimaryResponsible(tipo?: SolicitationTypeRef | null) {
  return isExperienceEvaluationTipo(tipo)
}

export function resolvePrimaryResponsibleForList(input: {
  tipo?: SolicitationTypeRef | null
  assumidaPor?: PersonRef | null
  assumidaPorId?: string | null
  approver?: PersonRef | null
  approverId?: string | null
  status?: string | null
  payload?: unknown
}) {
  const preferApprover = shouldUseApproverAsPrimaryResponsible(input.tipo)

  if (preferApprover && input.status === EXPERIENCE_EVALUATION_FINALIZATION_STATUS) {
    return {
      responsavelId: input.assumidaPor?.id ?? input.assumidaPorId ?? input.approver?.id ?? input.approverId ?? null,
      responsavel:
        input.assumidaPor?.fullName && input.assumidaPor.fullName.trim().length > 0
          ? { fullName: input.assumidaPor.fullName }
          : { fullName: 'RH / Coordenadores de Avaliação' },
    }
  }

  if (preferApprover) {
    const fallbackName = readFirstText(input.payload, [
      'gestorImediatoAvaliador',
      'avaliador',
      'gestor',
    ])
    const fallbackId = readFirstId(input.payload, [
      'gestorImediatoAvaliadorId',
      'avaliadorId',
      'gestorId',
    ])

    return {
      responsavelId: input.approver?.id ?? input.approverId ?? fallbackId,
      responsavel:
        input.approver?.fullName && input.approver.fullName.trim().length > 0
          ? { fullName: input.approver.fullName }
          : fallbackName
            ? { fullName: fallbackName }
            : null,
    }
  }

  return {
    responsavelId: input.assumidaPor?.id ?? input.assumidaPorId ?? null,
    responsavel:
      input.assumidaPor?.fullName && input.assumidaPor.fullName.trim().length > 0
        ? { fullName: input.assumidaPor.fullName }
        : null,
  }
}
