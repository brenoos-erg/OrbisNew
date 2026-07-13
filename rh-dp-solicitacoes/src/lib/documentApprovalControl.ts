import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { canApproveTechnicalDocument, canReviewQualityDocument, hasDocumentPermission } from '@/lib/documents/documentRoleAccess'

export async function getDocumentApprovalControl(userId: string) {
  return prisma.documentApprovalControl.findUnique({ where: { userId } })
}

export function isAdmin(user?: { role?: string | null } | null) {
  return user?.role === 'ADMIN'
}

export async function requireAdminUser() {
  const me = await requireActiveUser()
  if (!isAdmin(me)) throw new Error('Acesso restrito a administradores')
  return me
}

export async function canAccessApprovalDocuments(userId: string, userRole?: string | null) {
  if (isAdmin({ role: userRole })) return true
  if (await hasDocumentPermission(userId, 'CAN_APPROVE_TECHNICAL')) return true
  const control = await getDocumentApprovalControl(userId)
  return Boolean(control?.active && control.canApproveTab2)
}

export async function canAccessQualityReviewDocuments(userId: string, userRole?: string | null) {
  if (isAdmin({ role: userRole })) return true
  if (await hasDocumentPermission(userId, 'CAN_APPROVE_QUALITY')) return true
  const control = await getDocumentApprovalControl(userId)
  return Boolean(control?.active && control.canApproveTab3)
}

export async function canApproveDocumentStage(userId: string, stage: 2 | 3, userRole?: string | null, versionId?: string) {
  if (isAdmin({ role: userRole })) return true
  if (versionId) return stage === 2 ? canApproveTechnicalDocument(userId, versionId) : canReviewQualityDocument(userId, versionId)
  const control = await getDocumentApprovalControl(userId)
  if (!control || !control.active) return false
  return stage === 2 ? control.canApproveTab2 : control.canApproveTab3
}
