import { isExperienceEvaluationTipo } from './experienceEvaluationForm'

type PersonRef = {
  id?: string | null
  fullName?: string | null
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
}) {
  const preferApprover = shouldUseApproverAsPrimaryResponsible(input.tipo)

  if (preferApprover) {
    return {
      responsavelId: input.approver?.id ?? input.approverId ?? null,
      responsavel:
        input.approver?.fullName && input.approver.fullName.trim().length > 0
          ? { fullName: input.approver.fullName }
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
