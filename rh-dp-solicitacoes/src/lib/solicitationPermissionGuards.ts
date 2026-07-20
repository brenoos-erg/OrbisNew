import { prisma } from '@/lib/prisma'
import {
  isViewerOnlyByPolicy,
  resolveUserAccessContext,
  type UserAccessContext,
} from '@/lib/solicitationAccessPolicy'

export const VIEWER_ONLY_ACTION_ERROR =
  'Usuário possui apenas permissão de visualização para este tipo de solicitação.'

export async function isViewerOnlyForSolicitation(params: {
  solicitationId: string
  userId: string
  prismaClient?: typeof prisma
  userAccessContext?: UserAccessContext
}): Promise<boolean> {
  const db = params.prismaClient ?? prisma
  const [solicitation, user] = await Promise.all([
    db.solicitation.findUnique({
      where: { id: params.solicitationId },
      select: {
        tipoId: true,
        tipo: { select: { id: true, codigo: true, nome: true } },
        status: true,
        solicitanteId: true,
        approverId: true,
        assumidaPorId: true,
        departmentId: true,
        costCenterId: true,
        solicitacaoSetores: { select: { setor: true, status: true, constaFlag: true, finalizadoEm: true } },
        payload: true,
      },
    }),
    db.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        login: true,
        email: true,
        fullName: true,
        role: true,
        departmentId: true,
        department: { select: { id: true, code: true, name: true } },
      },
    }),
  ])

  if (!solicitation || !user) return false

  const userAccess = params.userAccessContext ?? await resolveUserAccessContext({
    userId: user.id,
    userLogin: user.login,
    userEmail: user.email,
    userFullName: user.fullName,
    role: user.role,
    primaryDepartmentId: user.departmentId,
    primaryDepartment: user.department,
  })

  return isViewerOnlyByPolicy(userAccess, solicitation)
}
