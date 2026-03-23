import { prisma } from '@/lib/prisma'

export async function getDocumentApprovalControl(userId: string) {
  return prisma.documentApprovalControl.findUnique({ where: { userId } })
}

export async function canApproveDocumentStage(userId: string, stage: 2 | 3) {
  const control = await getDocumentApprovalControl(userId)
  if (!control || !control.active) return false
  return stage === 2 ? control.canApproveTab2 : control.canApproveTab3
}