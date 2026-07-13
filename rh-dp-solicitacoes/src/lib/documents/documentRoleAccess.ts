import {
  DocumentApprovalDecisionStatus,
  DocumentApprovalRoundStatus,
  DocumentApprovalStepStatus,
  DocumentControlRole,
  DocumentFlowStepType,
  DocumentPermission,
  DocumentRoleAuditAction,
  DocumentRoleScopeType,
  DocumentSegregationConflictType,
  DocumentVersionStatus,
  ModuleLevel,
  Prisma,
  type DocumentRoleAssignment,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserModuleLevel } from '@/lib/access'
import { MODULE_KEYS } from '@/lib/featureKeys'

export type DocumentPermissionContext = {
  documentId?: string | null
  documentTypeId?: string | null
  departmentId?: string | null
  costCenterId?: string | null
  documentFamily?: string | null
  approverGroupId?: string | null
}

export type EffectiveDocumentPermission = {
  permission: DocumentPermission
  source: 'ROLE' | 'LEGACY_APPROVAL_CONTROL' | 'ADMIN' | 'MODULE_LEVEL'
  role?: DocumentControlRole
  assignmentId?: string
  scopeType?: DocumentRoleScopeType
}

export { DOCUMENT_ROLE_LABELS, ROLE_DEFAULT_PERMISSIONS } from '@/lib/documents/documentRoleCatalog'
import { ROLE_DEFAULT_PERMISSIONS } from '@/lib/documents/documentRoleCatalog'

export type NormalizedDocumentRoleInput = {
  userId: string
  role: DocumentControlRole
  active: boolean
  scopeType: DocumentRoleScopeType
  scopeKey: string
  departmentId: string | null
  costCenterId: string | null
  documentTypeId: string | null
  documentFamily: string | null
  documentId: string | null
  approverGroupId: string | null
  validFrom: Date | null
  validUntil: Date | null
  substituteForUserId: string | null
  temporaryReason: string | null
  justification: string | null
}

function parseDate(value: unknown, field: string) {
  if (!value) return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field} inválida.`)
  return parsed
}

function requireString(value: unknown, message: string) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(message)
  return text
}

export function normalizeDocumentRoleInput(body: any): NormalizedDocumentRoleInput {
  const userId = requireString(body?.userId, 'Usuário é obrigatório.')
  const role = requireString(body?.role, 'Papel documental é obrigatório.') as DocumentControlRole
  const scopeType = (body?.scopeType || 'GLOBAL') as DocumentRoleScopeType
  if (!Object.values(DocumentControlRole).includes(role)) throw new Error('Papel documental inválido.')
  if (!Object.values(DocumentRoleScopeType).includes(scopeType)) throw new Error('Escopo inválido.')

  const validFrom = parseDate(body?.validFrom, 'validFrom')
  const validUntil = parseDate(body?.validUntil, 'validUntil')
  if (validFrom && validUntil && validUntil < validFrom) throw new Error('validUntil deve ser maior ou igual a validFrom.')

  const normalized: NormalizedDocumentRoleInput = {
    userId,
    role,
    active: body?.active ?? true,
    scopeType,
    scopeKey: 'GLOBAL',
    departmentId: null,
    costCenterId: null,
    documentTypeId: null,
    documentFamily: null,
    documentId: null,
    approverGroupId: null,
    validFrom,
    validUntil,
    substituteForUserId: body?.substituteForUserId || null,
    temporaryReason: body?.temporaryReason?.trim() || null,
    justification: body?.justification?.trim() || null,
  }

  if (scopeType === 'DEPARTMENT') normalized.departmentId = requireString(body?.departmentId, 'departmentId é obrigatório para escopo DEPARTMENT.')
  if (scopeType === 'COST_CENTER') normalized.costCenterId = requireString(body?.costCenterId, 'costCenterId é obrigatório para escopo COST_CENTER.')
  if (scopeType === 'DOCUMENT_TYPE') normalized.documentTypeId = requireString(body?.documentTypeId, 'documentTypeId é obrigatório para escopo DOCUMENT_TYPE.')
  if (scopeType === 'DOCUMENT_FAMILY') normalized.documentFamily = requireString(body?.documentFamily, 'documentFamily é obrigatório para escopo DOCUMENT_FAMILY.')
  if (scopeType === 'DOCUMENT') normalized.documentId = requireString(body?.documentId, 'documentId é obrigatório para escopo DOCUMENT.')
  if (scopeType === 'APPROVER_GROUP') normalized.approverGroupId = requireString(body?.approverGroupId, 'approverGroupId é obrigatório para escopo APPROVER_GROUP.')

  normalized.scopeKey =
    normalized.departmentId ??
    normalized.costCenterId ??
    normalized.documentTypeId ??
    normalized.documentFamily ??
    normalized.documentId ??
    normalized.approverGroupId ??
    'GLOBAL'

  if (normalized.substituteForUserId && !normalized.temporaryReason) throw new Error('Motivo da substituição temporária é obrigatório.')
  if (['DOCUMENT_MANAGER', 'DOCUMENT_PUBLISHER'].includes(role) && !normalized.justification) throw new Error('Justificativa obrigatória para papel crítico.')

  return normalized
}

export function scopeSnapshot(value: Pick<DocumentRoleAssignment, 'scopeType' | 'scopeKey' | 'departmentId' | 'costCenterId' | 'documentTypeId' | 'documentFamily' | 'documentId' | 'approverGroupId'>) {
  return {
    scopeType: value.scopeType,
    scopeKey: value.scopeKey,
    departmentId: value.departmentId,
    costCenterId: value.costCenterId,
    documentTypeId: value.documentTypeId,
    documentFamily: value.documentFamily,
    documentId: value.documentId,
    approverGroupId: value.approverGroupId,
  }
}

function isActiveNow(assignment: Pick<DocumentRoleAssignment, 'active' | 'validFrom' | 'validUntil' | 'disabledAt'>, now = new Date()) {
  return assignment.active && !assignment.disabledAt && (!assignment.validFrom || assignment.validFrom <= now) && (!assignment.validUntil || assignment.validUntil >= now)
}

export function matchesDocumentRoleScope(assignment: Pick<DocumentRoleAssignment, 'scopeType' | 'scopeKey' | 'departmentId' | 'costCenterId' | 'documentTypeId' | 'documentFamily' | 'documentId' | 'approverGroupId'>, context: DocumentPermissionContext = {}) {
  switch (assignment.scopeType) {
    case 'GLOBAL': return true
    case 'DEPARTMENT': return Boolean(assignment.departmentId && assignment.departmentId === context.departmentId)
    case 'COST_CENTER': return Boolean(assignment.costCenterId && assignment.costCenterId === context.costCenterId)
    case 'DOCUMENT_TYPE': return Boolean(assignment.documentTypeId && assignment.documentTypeId === context.documentTypeId)
    case 'DOCUMENT_FAMILY': return Boolean(assignment.documentFamily && assignment.documentFamily === context.documentFamily)
    case 'DOCUMENT': return Boolean(assignment.documentId && assignment.documentId === context.documentId)
    case 'APPROVER_GROUP': return Boolean(assignment.approverGroupId && assignment.approverGroupId === context.approverGroupId)
    default: return false
  }
}

export async function getDocumentRoleAssignments(userId: string) {
  return prisma.documentRoleAssignment.findMany({
    where: { userId },
    include: {
      user: { select: { id: true, fullName: true, email: true, department: true, costCenter: true } },
      department: true,
      costCenter: true,
      documentType: true,
      document: { select: { id: true, code: true, title: true } },
      approverGroup: true,
      createdBy: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: [{ active: 'desc' }, { user: { fullName: 'asc' } }, { role: 'asc' }],
  })
}

export async function getEffectiveDocumentPermissions(userId: string, context: DocumentPermissionContext = {}) {
  const [user, moduleLevel, assignments, legacy] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    getUserModuleLevel(userId, MODULE_KEYS.CONTROLE_DOCUMENTOS),
    prisma.documentRoleAssignment.findMany({ where: { userId } }),
    prisma.documentApprovalControl.findUnique({ where: { userId } }),
  ])
  const effective = new Map<DocumentPermission, EffectiveDocumentPermission>()

  if (user?.role === 'ADMIN') {
    for (const permission of Object.values(DocumentPermission)) effective.set(permission, { permission, source: 'ADMIN' })
  }
  if (moduleLevel) effective.set('CAN_VIEW_PUBLISHED', { permission: 'CAN_VIEW_PUBLISHED', source: 'MODULE_LEVEL' })

  for (const assignment of assignments) {
    if (!isActiveNow(assignment) || !matchesDocumentRoleScope(assignment, context)) continue
    for (const permission of ROLE_DEFAULT_PERMISSIONS[assignment.role]) {
      effective.set(permission, { permission, source: 'ROLE', role: assignment.role, assignmentId: assignment.id, scopeType: assignment.scopeType })
    }
  }

  if (legacy?.active) {
    if (legacy.canApproveTab2) effective.set('CAN_APPROVE_TECHNICAL', { permission: 'CAN_APPROVE_TECHNICAL', source: 'LEGACY_APPROVAL_CONTROL', role: 'TECHNICAL_APPROVER' })
    if (legacy.canApproveTab3) effective.set('CAN_APPROVE_QUALITY', { permission: 'CAN_APPROVE_QUALITY', source: 'LEGACY_APPROVAL_CONTROL', role: 'QUALITY_REVIEWER' })
  }

  return [...effective.values()]
}

export async function hasDocumentPermission(userId: string, permission: DocumentPermission, context: DocumentPermissionContext = {}) {
  return (await getEffectiveDocumentPermissions(userId, context)).some((item) => item.permission === permission)
}

export async function requireDocumentPermission(userId: string, permission: DocumentPermission, context: DocumentPermissionContext = {}) {
  if (!(await hasDocumentPermission(userId, permission, context))) throw new Error('Usuário não possui permissão documental suficiente.')
}

export async function canManageDocumentRoles(userId: string, userRole?: string | null) {
  if (userRole === 'ADMIN') return true
  const [level, hasAnyAssignment] = await Promise.all([
    getUserModuleLevel(userId, MODULE_KEYS.CONTROLE_DOCUMENTOS),
    prisma.documentRoleAssignment.findFirst({ select: { id: true }, where: { active: true } }),
  ])
  if (!hasAnyAssignment) return userRole === 'ADMIN'
  return level === ModuleLevel.NIVEL_3 && (await hasDocumentPermission(userId, 'CAN_MANAGE_DOCUMENT_ROLES'))
}

export async function getDocumentContextByVersionId(versionId: string): Promise<DocumentPermissionContext & { authorUserId?: string | null; status?: DocumentVersionStatus | null }> {
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: { select: { id: true, documentTypeId: true, ownerDepartmentId: true, ownerCostCenterId: true, code: true, authorUserId: true } } },
  })
  if (!version?.document) return {}
  return {
    documentId: version.documentId,
    documentTypeId: version.document.documentTypeId,
    departmentId: version.document.ownerDepartmentId,
    costCenterId: version.document.ownerCostCenterId,
    documentFamily: version.document.code.split('.')[1] ?? null,
    authorUserId: version.document.authorUserId,
    status: version.status,
  }
}

export async function getDocumentContextByDocumentId(documentId: string): Promise<DocumentPermissionContext & { authorUserId?: string | null }> {
  const document = await prisma.isoDocument.findUnique({ where: { id: documentId }, select: { id: true, documentTypeId: true, ownerDepartmentId: true, ownerCostCenterId: true, code: true, authorUserId: true } })
  if (!document) return {}
  return { documentId, documentTypeId: document.documentTypeId, departmentId: document.ownerDepartmentId, costCenterId: document.ownerCostCenterId, documentFamily: document.code.split('.')[1] ?? null, authorUserId: document.authorUserId }
}

async function currentPendingApprovalStep(versionId: string) {
  const round = await prisma.documentApprovalRound.findFirst({
    where: { versionId, status: DocumentApprovalRoundStatus.PENDING },
    orderBy: { roundNumber: 'desc' },
    include: { steps: { where: { status: DocumentApprovalStepStatus.PENDING }, orderBy: { order: 'asc' }, take: 1, include: { decisions: true, flowItem: true } } },
  })
  const step = round?.steps[0] ?? null
  return round && step ? { round, step } : null
}

export async function canApproveTechnicalDocument(userId: string, versionId: string) {
  const [context, current] = await Promise.all([getDocumentContextByVersionId(versionId), currentPendingApprovalStep(versionId)])
  if (!current || context.status !== DocumentVersionStatus.AG_APROVACAO) return false
  if (current.step.stepType === DocumentFlowStepType.QUALITY) return false
  if (context.authorUserId === userId) return false
  const decision = current.step.decisions.find((item) => item.userId === userId && item.status === DocumentApprovalDecisionStatus.PENDING)
  if (!decision) return false
  const groupContext = { ...context, approverGroupId: current.step.flowItem.approverGroupId }
  return hasDocumentPermission(userId, 'CAN_APPROVE_TECHNICAL', groupContext)
}

export async function canReviewQualityDocument(userId: string, versionId: string) {
  const [context, current] = await Promise.all([getDocumentContextByVersionId(versionId), currentPendingApprovalStep(versionId)])
  if (!current || context.status !== DocumentVersionStatus.EM_ANALISE_QUALIDADE) return false
  if (current.step.stepType !== DocumentFlowStepType.QUALITY) return false
  if (context.authorUserId === userId) return false
  const decision = current.step.decisions.find((item) => item.userId === userId && item.status === DocumentApprovalDecisionStatus.PENDING)
  if (!decision) return false
  const groupContext = { ...context, approverGroupId: current.step.flowItem.approverGroupId }
  return hasDocumentPermission(userId, 'CAN_APPROVE_QUALITY', groupContext)
}

export async function canPublishDocument(userId: string, versionId: string) {
  return hasDocumentPermission(userId, 'CAN_PUBLISH_DOCUMENT', await getDocumentContextByVersionId(versionId))
}
export async function canCancelDocument(userId: string, documentId: string) { return hasDocumentPermission(userId, 'CAN_CANCEL_DOCUMENT', await getDocumentContextByDocumentId(documentId)) }
export async function canDeleteDocumentByPostingError(userId: string, documentId: string) { return hasDocumentPermission(userId, 'CAN_DELETE_POSTING_ERROR', await getDocumentContextByDocumentId(documentId)) }
export async function canCreateDocument(userId: string, context: DocumentPermissionContext) { return hasDocumentPermission(userId, 'CAN_CREATE_DOCUMENT', context) }
export async function canCreateRevision(userId: string, context: DocumentPermissionContext) { return hasDocumentPermission(userId, 'CAN_CREATE_REVISION', context) }

export function detectSegregationConflicts(roles: DocumentControlRole[]) {
  const roleSet = new Set(roles)
  const conflicts: DocumentSegregationConflictType[] = []
  if (roleSet.has('TECHNICAL_APPROVER') && roleSet.has('QUALITY_REVIEWER')) conflicts.push('TECHNICAL_AND_QUALITY_APPROVER')
  if (roleSet.has('DOCUMENT_AUTHOR') && roleSet.has('DOCUMENT_MANAGER')) conflicts.push('AUTHOR_AND_DOCUMENT_MANAGER')
  if ((roleSet.has('TECHNICAL_APPROVER') || roleSet.has('QUALITY_REVIEWER')) && roleSet.has('DOCUMENT_MANAGER')) conflicts.push('APPROVER_AND_POSTING_ERROR_DELETER')
  return conflicts
}

export async function createDocumentRoleAudit(tx: Prisma.TransactionClient, input: {
  assignmentId?: string | null
  targetUserId: string
  actorUserId: string
  action: DocumentRoleAuditAction
  before?: Partial<DocumentRoleAssignment> | null
  after?: Partial<DocumentRoleAssignment> | null
  justification?: string | null
  conflictType?: DocumentSegregationConflictType | null
}) {
  await tx.documentRoleAuditLog.create({
    data: {
      assignmentId: input.assignmentId ?? null,
      targetUserId: input.targetUserId,
      actorUserId: input.actorUserId,
      action: input.action,
      roleBefore: input.before?.role ?? null,
      roleAfter: input.after?.role ?? null,
      permissionsBefore: input.before?.role ? ROLE_DEFAULT_PERMISSIONS[input.before.role] : undefined,
      permissionsAfter: input.after?.role ? ROLE_DEFAULT_PERMISSIONS[input.after.role] : undefined,
      scopeBefore: input.before ? scopeSnapshot(input.before as DocumentRoleAssignment) : undefined,
      scopeAfter: input.after ? scopeSnapshot(input.after as DocumentRoleAssignment) : undefined,
      validFromBefore: input.before?.validFrom ?? null,
      validFromAfter: input.after?.validFrom ?? null,
      validUntilBefore: input.before?.validUntil ?? null,
      validUntilAfter: input.after?.validUntil ?? null,
      justification: input.justification ?? null,
      conflictType: input.conflictType ?? null,
    },
  })
}
