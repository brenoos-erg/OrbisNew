import { Action } from '@prisma/client'
import { userHasRhAccess } from '@/lib/rhAccess'

export async function canAccessRhPositions(
  user: { id: string; role?: string | null; departmentId?: string | null },
  action: Action = Action.VIEW,
) {
  void action
  return userHasRhAccess(user)
}

export async function assertCanAccessRhPositions(
  user: { id: string; role?: string | null; departmentId?: string | null },
) {
  if (!(await canAccessRhPositions(user))) {
    throw new Error('Acesso restrito ao departamento de Recursos Humanos.')
  }
}
