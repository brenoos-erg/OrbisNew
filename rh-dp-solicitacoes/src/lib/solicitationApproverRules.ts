export function pickEligibleTipoApproverId(userIds: string[]): string | null {
  return userIds[0] ?? null
}

export function resolveApprovalRecipientId(params: {
  solicitationApproverId?: string | null
  fallbackTipoApproverId?: string | null
}): string | null {
  return params.solicitationApproverId ?? params.fallbackTipoApproverId ?? null
}