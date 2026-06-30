import { isSolicitacaoEpiUniforme } from '@/lib/solicitationTypes'

type EpiSolicitationLike = {
  requiresApproval?: boolean | null
  approvalStatus?: string | null
  status?: string | null
  approverId?: string | null
  tipo?: { id?: string | null; codigo?: string | null; nome?: string | null } | null
  anexos?: unknown[] | null
  department?: { code?: string | null; name?: string | null } | null
}

export function isEpiUniformeApprovalPending(solicitation?: EpiSolicitationLike | null) {
  return Boolean(
    solicitation &&
      isSolicitacaoEpiUniforme(solicitation.tipo) &&
      solicitation.requiresApproval === true &&
      solicitation.approvalStatus === 'PENDENTE',
  )
}

export function isEpiUniformeWaitingFicha(solicitation?: EpiSolicitationLike | null) {
  return Boolean(
    solicitation &&
      isSolicitacaoEpiUniforme(solicitation.tipo) &&
      solicitation.department?.code === '19' &&
      solicitation.requiresApproval === false &&
      solicitation.approvalStatus === 'NAO_PRECISA' &&
      (solicitation.anexos?.length ?? 0) === 0,
  )
}

export function isEpiUniformeReadyToForwardApproval(solicitation?: EpiSolicitationLike | null) {
  return Boolean(
    solicitation &&
      isSolicitacaoEpiUniforme(solicitation.tipo) &&
      solicitation.department?.code === '19' &&
      solicitation.requiresApproval === false &&
      solicitation.approvalStatus === 'NAO_PRECISA' &&
      (solicitation.anexos?.length ?? 0) > 0,
  )
}

export function getEpiUniformeReceivedResponsibilityLabel(solicitation?: EpiSolicitationLike | null) {
  if (isEpiUniformeWaitingFicha(solicitation)) return 'Aguardando SST anexar Ficha de EPI'
  if (isEpiUniformeReadyToForwardApproval(solicitation)) return 'Aguardando encaminhamento para aprovação'
  return null
}
