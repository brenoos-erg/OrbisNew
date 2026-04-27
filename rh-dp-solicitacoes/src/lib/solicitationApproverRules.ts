export function pickEligibleTipoApproverId(userIds: string[]): string | null {
  return userIds[0] ?? null
}

export function resolveApprovalRecipientId(params: {
  solicitationApproverId?: string | null
  fallbackTipoApproverId?: string | null
}): string | null {
  return params.solicitationApproverId ?? params.fallbackTipoApproverId ?? null
}

export function resolveEquipmentApprovalMode(params: {
  approverId?: string | null
}): 'APPROVAL' | 'TI_QUEUE' {
  return params.approverId ? 'APPROVAL' : 'TI_QUEUE'
}
