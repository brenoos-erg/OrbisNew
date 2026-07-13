import { DocumentPermission, type DocumentControlRole, type DocumentRoleScopeType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getEffectiveDocumentPermissions, matchesDocumentRoleScope, type DocumentPermissionContext } from '@/lib/documents/documentRoleAccess'

export type SourceFileDisposition = 'inline' | 'attachment'

export type SourceFileAccessResult = {
  allowed: boolean
  sourceFileAvailable: boolean
  canViewSourceFile: boolean
  canDownloadSourceFile: boolean
  role?: DocumentControlRole
  permissionSource?: 'ROLE' | 'LEGACY_APPROVAL_CONTROL' | 'ADMIN' | 'MODULE_LEVEL'
  scopeType?: DocumentRoleScopeType
  assignmentId?: string
  reason?: string
}


export function canDocumentAuthorAccessSourceFile(input: { isOwnDocument: boolean; assignmentScopeType?: DocumentRoleScopeType | null; scopeMatches: boolean }) {
  if (input.isOwnDocument) return true
  return input.assignmentScopeType !== 'GLOBAL' && input.scopeMatches
}

export function isTechnicalApproverSourceSnapshotAllowed(input: { userId: string; snapshots: Array<{ userId: string; stepType: string; policy: string }> }) {
  return input.snapshots.some((snapshot) =>
    snapshot.userId === input.userId && snapshot.stepType !== 'QUALITY' && snapshot.policy === 'CURRENT_AND_HISTORICAL',
  )
}

export async function getSourceFileContextByVersionId(versionId: string) {
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: {
      sourceApproverSnapshots: true,
      document: {
        select: {
          id: true,
          code: true,
          title: true,
          documentTypeId: true,
          ownerDepartmentId: true,
          ownerCostCenterId: true,
          authorUserId: true,
          isActive: true,
        },
      },
    },
  })
  if (!version) return null
  const context: DocumentPermissionContext & { authorUserId?: string | null } = {
    documentId: version.documentId,
    documentTypeId: version.document.documentTypeId,
    departmentId: version.document.ownerDepartmentId,
    costCenterId: version.document.ownerCostCenterId,
    documentFamily: version.document.code.split('.')[1] ?? null,
    authorUserId: version.document.authorUserId,
  }
  return { version, context }
}

export async function resolveSourceFileAccess(userId: string, versionId: string, disposition: SourceFileDisposition): Promise<SourceFileAccessResult> {
  const loaded = await getSourceFileContextByVersionId(versionId)
  if (!loaded) return { allowed: false, sourceFileAvailable: false, canViewSourceFile: false, canDownloadSourceFile: false, reason: 'NOT_FOUND' }
  const { version, context } = loaded
  const sourceFileAvailable = Boolean(version.sourceStorageKey || version.sourceFileUrl)
  if (!sourceFileAvailable) return { allowed: false, sourceFileAvailable, canViewSourceFile: false, canDownloadSourceFile: false, reason: 'MISSING_SOURCE_FILE' }

  const permissions = await getEffectiveDocumentPermissions(userId, context)
  const canViewSourceFile = permissions.some((item) => item.permission === DocumentPermission.CAN_VIEW_SOURCE_FILE)
  const canDownloadSourceFile = permissions.some((item) => item.permission === DocumentPermission.CAN_DOWNLOAD_SOURCE_FILE)
  const requiredPermission = disposition === 'attachment' ? DocumentPermission.CAN_DOWNLOAD_SOURCE_FILE : DocumentPermission.CAN_VIEW_SOURCE_FILE
  const matching = permissions.find((item) => item.permission === requiredPermission)
  if (!matching) return { allowed: false, sourceFileAvailable, canViewSourceFile, canDownloadSourceFile, reason: 'MISSING_PERMISSION' }

  if (matching.source === 'ROLE' && matching.role === 'DOCUMENT_AUTHOR') {
    if (version.document.authorUserId === userId) {
      return { allowed: true, sourceFileAvailable, canViewSourceFile, canDownloadSourceFile, role: matching.role, permissionSource: matching.source, scopeType: matching.scopeType, assignmentId: matching.assignmentId }
    }
    const assignment = matching.assignmentId
      ? await prisma.documentRoleAssignment.findUnique({ where: { id: matching.assignmentId } })
      : null
    const authorScopeAllowsDocument = canDocumentAuthorAccessSourceFile({
      isOwnDocument: false,
      assignmentScopeType: assignment?.scopeType ?? null,
      scopeMatches: assignment ? matchesDocumentRoleScope(assignment, context) : false,
    })
    if (!authorScopeAllowsDocument) {
      return { allowed: false, sourceFileAvailable, canViewSourceFile, canDownloadSourceFile, reason: 'AUTHOR_OUT_OF_SCOPE' }
    }
  }

  if (matching.source === 'ROLE' && matching.role === 'TECHNICAL_APPROVER') {
    const belongsToSnapshotOrCurrentStep = isTechnicalApproverSourceSnapshotAllowed({ userId, snapshots: version.sourceApproverSnapshots })
    if (!belongsToSnapshotOrCurrentStep) {
      return { allowed: false, sourceFileAvailable, canViewSourceFile, canDownloadSourceFile, reason: 'APPROVER_NOT_IN_FLOW' }
    }
  }

  return { allowed: true, sourceFileAvailable, canViewSourceFile, canDownloadSourceFile, role: matching.role, permissionSource: matching.source, scopeType: matching.scopeType, assignmentId: matching.assignmentId }
}
