export type SolicitationVisibilityReason =
  | 'REQUESTER'
  | 'ASSIGNED_USER'
  | 'APPROVER'
  | 'CURRENT_DEPARTMENT'
  | 'CURRENT_COST_CENTER'
  | 'NADA_CONSTA_SECTOR'
  | 'TIPO_APPROVER'
  | 'TIPO_VIEWER'
  | 'TIPO_FINALIZER'
  | 'SHARED_RH_DP_FLOW'
  | 'LEGACY_FALLBACK'
  | 'ADMIN_TECHNICAL_FALLBACK'

export type SolicitationVisibilityResult = {
  canView: boolean
  reasons: SolicitationVisibilityReason[]
}

export type SolicitationVisibilityUserContext = {
  userId: string
  role?: string | null
  departmentIds?: Array<string | null | undefined>
  costCenterIds?: Array<string | null | undefined>
  nadaConstaSetores?: Array<string | null | undefined>
  tipoApproverTipoIds?: Array<string | null | undefined>
  tipoViewerTipoIds?: Array<string | null | undefined>
  tipoFinalizerTipoIds?: Array<string | null | undefined>
  sharedRhDpDepartmentIds?: Array<string | null | undefined>
  sharedRhDpCostCenterIds?: Array<string | null | undefined>
  solicitationModuleLevel?: string | null
  configuracoesModuleLevel?: string | null
  isAdminTechnical?: boolean
}

export type SolicitationVisibilitySolicitation = {
  id?: string | null
  protocolo?: string | null
  tipoId?: string | null
  solicitanteId?: string | null
  assumidaPorId?: string | null
  approverId?: string | null
  departmentId?: string | null
  costCenterId?: string | null
  workflowSnapshotJson?: unknown | null
  approvalSnapshotJson?: unknown | null
  notificationSnapshotJson?: unknown | null
  tipo?: {
    id?: string | null
    nome?: string | null
  } | null
  solicitacaoSetores?: Array<{
    setor?: string | null
  }> | null
}

function toSet(values?: Array<string | null | undefined>) {
  return new Set(
    (values ?? [])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  )
}

function toUpperSet(values?: Array<string | null | undefined>) {
  return new Set([...toSet(values)].map((value) => value.toUpperCase()))
}

function hasSnapshotField(
  solicitation: SolicitationVisibilitySolicitation,
  field: 'workflowSnapshotJson' | 'approvalSnapshotJson' | 'notificationSnapshotJson',
) {
  return Object.prototype.hasOwnProperty.call(solicitation, field)
}

function isMissingLegacySnapshots(
  solicitation: SolicitationVisibilitySolicitation,
) {
  const snapshotFields = [
    'workflowSnapshotJson',
    'approvalSnapshotJson',
    'notificationSnapshotJson',
  ] as const

  const hasAnySnapshotField = snapshotFields.some((field) =>
    hasSnapshotField(solicitation, field),
  )

  if (!hasAnySnapshotField) return true

  return snapshotFields.some((field) => solicitation[field] == null)
}

function hasOperationalOwner(solicitation: SolicitationVisibilitySolicitation) {
  return Boolean(
    solicitation.solicitanteId ||
      solicitation.assumidaPorId ||
      solicitation.approverId ||
      solicitation.departmentId ||
      solicitation.costCenterId ||
      (solicitation.solicitacaoSetores?.length ?? 0) > 0,
  )
}

function pushReason(
  reasons: SolicitationVisibilityReason[],
  reason: SolicitationVisibilityReason,
) {
  if (!reasons.includes(reason)) {
    reasons.push(reason)
  }
}

export function canUserViewSolicitationByFallback(
  ctx: SolicitationVisibilityUserContext,
  solicitation: SolicitationVisibilitySolicitation,
): SolicitationVisibilityResult {
  const reasons: SolicitationVisibilityReason[] = []
  const departmentIds = toSet(ctx.departmentIds)
  const costCenterIds = toSet(ctx.costCenterIds)
  const nadaConstaSetores = toUpperSet(ctx.nadaConstaSetores)
  const tipoApproverTipoIds = toSet(ctx.tipoApproverTipoIds)
  const tipoViewerTipoIds = toSet(ctx.tipoViewerTipoIds)
  const tipoFinalizerTipoIds = toSet(ctx.tipoFinalizerTipoIds)
  const sharedRhDpDepartmentIds = toSet(ctx.sharedRhDpDepartmentIds)
  const sharedRhDpCostCenterIds = toSet(ctx.sharedRhDpCostCenterIds)

  if (solicitation.solicitanteId === ctx.userId) {
    pushReason(reasons, 'REQUESTER')
  }

  if (solicitation.assumidaPorId === ctx.userId) {
    pushReason(reasons, 'ASSIGNED_USER')
  }

  if (solicitation.approverId === ctx.userId) {
    pushReason(reasons, 'APPROVER')
  }

  if (
    solicitation.departmentId &&
    departmentIds.has(solicitation.departmentId)
  ) {
    pushReason(reasons, 'CURRENT_DEPARTMENT')
  }

  if (
    solicitation.costCenterId &&
    costCenterIds.has(solicitation.costCenterId)
  ) {
    pushReason(reasons, 'CURRENT_COST_CENTER')
  }

  if (
    nadaConstaSetores.size > 0 &&
    solicitation.solicitacaoSetores?.some((item) =>
      item.setor ? nadaConstaSetores.has(item.setor.toUpperCase()) : false,
    )
  ) {
    pushReason(reasons, 'NADA_CONSTA_SECTOR')
  }

  if (solicitation.tipoId && tipoApproverTipoIds.has(solicitation.tipoId)) {
    pushReason(reasons, 'TIPO_APPROVER')
  }

  if (solicitation.tipoId && tipoViewerTipoIds.has(solicitation.tipoId)) {
    pushReason(reasons, 'TIPO_VIEWER')
  }

  if (solicitation.tipoId && tipoFinalizerTipoIds.has(solicitation.tipoId)) {
    pushReason(reasons, 'TIPO_FINALIZER')
  }

  if (
    (solicitation.departmentId &&
      sharedRhDpDepartmentIds.has(solicitation.departmentId)) ||
    (solicitation.costCenterId &&
      sharedRhDpCostCenterIds.has(solicitation.costCenterId))
  ) {
    pushReason(reasons, 'SHARED_RH_DP_FLOW')
  }

  if (!hasOperationalOwner(solicitation) && ctx.isAdminTechnical) {
    pushReason(reasons, 'ADMIN_TECHNICAL_FALLBACK')
  }

  if (reasons.length > 0 && isMissingLegacySnapshots(solicitation)) {
    pushReason(reasons, 'LEGACY_FALLBACK')
  }

  return {
    canView: reasons.length > 0,
    reasons,
  }
}
