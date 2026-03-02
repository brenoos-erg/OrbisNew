import { prisma } from '@/lib/prisma'

export async function isViewerOnlyForSolicitation(params: {
  solicitationId: string
  userId: string
}): Promise<boolean> {
  const solicitation = await prisma.solicitation.findUnique({
    where: { id: params.solicitationId },
    select: { tipoId: true },
  })

  if (!solicitation) return false

  const role = await prisma.tipoSolicitacaoApprover.findUnique({
    where: {
      tipoId_userId: {
        tipoId: solicitation.tipoId,
        userId: params.userId,
      },
    },
    select: { role: true },
  })

  return role?.role === 'VIEWER'
}