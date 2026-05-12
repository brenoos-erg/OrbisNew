export type SentCancellationRow = {
  status?: string | null
  assumidaPorId?: string | null
}

export type SentCancellationAction = {
  enabled: boolean
  label: 'Cancelar' | 'Solicitar cancelamento'
  mode: 'DIRECT' | 'REQUEST'
  title: string
}

export const SENT_CANCELLATION_CLOSED_STATUSES = new Set(['CANCELADA', 'CONCLUIDA', 'FINALIZADA', 'REJEITADA'])
export const SENT_CANCELLATION_DIRECT_STATUSES = new Set(['ABERTA', 'AGUARDANDO_ATENDIMENTO', 'AGUARDANDO_APROVACAO'])

export function resolveSentCancellationAction(row: SentCancellationRow | null): SentCancellationAction {
  if (!row) {
    return { enabled: false, label: 'Cancelar', mode: 'DIRECT', title: 'Selecione uma solicitação' }
  }

  const status = String(row.status ?? '').toUpperCase()
  if (SENT_CANCELLATION_CLOSED_STATUSES.has(status)) {
    return { enabled: false, label: 'Cancelar', mode: 'DIRECT', title: 'Esta solicitação já está encerrada' }
  }

  if (!row.assumidaPorId && SENT_CANCELLATION_DIRECT_STATUSES.has(status)) {
    return { enabled: true, label: 'Cancelar', mode: 'DIRECT', title: 'Cancelar solicitação' }
  }

  return {
    enabled: true,
    label: 'Solicitar cancelamento',
    mode: 'REQUEST',
    title: 'Solicitar cancelamento',
  }
}
