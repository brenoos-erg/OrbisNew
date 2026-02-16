import { ModuleLevel, NonConformityApprovalStatus, NonConformityStatus } from '@prisma/client'

export const NC_INITIAL_EDITABLE_FIELDS = ['descricao', 'evidenciaObjetiva'] as const

export function canApproveNc(level: ModuleLevel | undefined) {
  return level === ModuleLevel.NIVEL_2 || level === ModuleLevel.NIVEL_3
}

export function canManageAllNc(level: ModuleLevel | undefined) {
  return level === ModuleLevel.NIVEL_3
}

export function isApproved(approvalStatus: NonConformityApprovalStatus) {
  return approvalStatus === NonConformityApprovalStatus.APROVADO
}

export function shouldSetClosedAt(status?: NonConformityStatus) {
  return status === NonConformityStatus.ENCERRADA
}