import { NonConformityActionStatus } from '@prisma/client'

type ResolveActionStatusInput = {
  currentStatus?: NonConformityActionStatus | null
  requestedStatus?: unknown
  prazo?: Date | null
  dataInicioPrevista?: Date | null
  dataConclusao?: Date | null
  now?: Date
}

const TERMINAL_STATUS = new Set<NonConformityActionStatus>([
  NonConformityActionStatus.CONCLUIDA,
  NonConformityActionStatus.CANCELADA,
])

function toDateOnly(value?: Date | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isTypedStatus(value: unknown): value is NonConformityActionStatus {
  return Object.values(NonConformityActionStatus).includes(value as NonConformityActionStatus)
}

export function isActionOverdue(input: {
  prazo?: Date | null
  dataConclusao?: Date | null
  status?: NonConformityActionStatus | null
  now?: Date
}) {
  if (!input.prazo) return false
  if (input.dataConclusao) return false
  if (input.status && TERMINAL_STATUS.has(input.status)) return false

  const today = toDateOnly(input.now ?? new Date())
  const prazoDate = toDateOnly(input.prazo)
  if (!today || !prazoDate) return false
  return prazoDate < today
}

export function resolveAutomaticActionStatus(input: ResolveActionStatusInput): NonConformityActionStatus {
  const requestedStatus = isTypedStatus(input.requestedStatus) ? input.requestedStatus : null
  if (requestedStatus && TERMINAL_STATUS.has(requestedStatus)) return requestedStatus
  if (input.dataConclusao) return NonConformityActionStatus.CONCLUIDA

  const baseStatus = requestedStatus ?? input.currentStatus ?? NonConformityActionStatus.PENDENTE
  if (baseStatus === NonConformityActionStatus.CANCELADA) return NonConformityActionStatus.CANCELADA

  const overdue = isActionOverdue({
    prazo: input.prazo,
    dataConclusao: input.dataConclusao,
    status: baseStatus,
    now: input.now,
  })
  if (overdue) return NonConformityActionStatus.EM_ANDAMENTO

  const today = toDateOnly(input.now ?? new Date())
  const dataInicio = toDateOnly(input.dataInicioPrevista)
  if (today && dataInicio && dataInicio <= today) {
    return NonConformityActionStatus.EM_ANDAMENTO
  }

  if (baseStatus === NonConformityActionStatus.EM_ANDAMENTO) return baseStatus
  return NonConformityActionStatus.PENDENTE
}
