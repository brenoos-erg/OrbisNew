import { prisma } from '@/lib/prisma'

export const VIEWER_ONLY_ACTION_ERROR =
  'Usuário possui apenas permissão de visualização para este tipo de solicitação.'

export async function isViewerOnlyForSolicitation(params: {
  solicitationId: string
  userId: string
}): Promise<boolean> {
  const solicitation = await prisma.solicitation.findUnique({
    where: { id: params.solicitationId },
    select: { tipoId: true },
  })

  if (!solicitation) return false

  const roles = await prisma.tipoSolicitacaoApprover.findMany({
    where: {
      tipoId: solicitation.tipoId,
      userId: params.userId,
    },
    select: { role: true },
  })

  if (roles.length === 0) return false
  const normalizedRoles = new Set(roles.map((row) => String(row.role).toUpperCase()))
  return (
    (normalizedRoles.has('VIEWER') || normalizedRoles.has('VISUALIZADOR')) &&
    !normalizedRoles.has('APPROVER') &&
    !normalizedRoles.has('FINALIZER')
  )
}
