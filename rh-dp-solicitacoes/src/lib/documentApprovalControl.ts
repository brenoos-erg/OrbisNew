import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'

export async function getDocumentApprovalControl(userId: string) {
  return prisma.documentApprovalControl.findUnique({ where: { userId } })
}

export function isAdmin(user?: { role?: string | null } | null) {
  return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
}

export async function requireAdminUser() {
  const me = await requireActiveUser()
  if (!isAdmin(me)) {
    throw new Error('Acesso restrito a administradores')
  }
  return me
}

export async function canAccessApprovalDocuments(userId: string, userRole?: string | null) {
  if (isAdmin({ role: userRole })) return true
  const control = await getDocumentApprovalControl(userId)
  return Boolean(control?.active && control.canApproveTab2)
}

export async function canAccessQualityReviewDocuments(userId: string, userRole?: string | null) {
  if (isAdmin({ role: userRole })) return true
  const control = await getDocumentApprovalControl(userId)
  return Boolean(control?.active && control.canApproveTab3)
}

export async function canApproveDocumentStage(userId: string, stage: 2 | 3, userRole?: string | null) {
  if (isAdmin({ role: userRole })) return true
  const control = await getDocumentApprovalControl(userId)
  if (!control || !control.active) return false
  return stage === 2 ? control.canApproveTab2 : control.canApproveTab3
}
