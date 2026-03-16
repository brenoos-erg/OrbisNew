import { Prisma, Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  buildReceivedSolicitationVisibilityWhere,
  canUserViewSolicitationByDepartment,
  resolveUserSetorKeysFromDepartments,
} from '@/lib/solicitationVisibility'

export type UserAccessContext = {
  userId: string
  role: Role
  userDepartmentIds: string[]
  userSetorKeys: string[]
}

type DepartmentLike = { id?: string | null; code?: string | null; name?: string | null }

type SolicitationLike = {
  solicitanteId: string
  approverId?: string | null
  assumidaPorId?: string | null
  departmentId?: string | null
  solicitacaoSetores?: { setor?: string | null }[]
}

export async function resolveUserAccessContext(input: {
  userId: string
  role: Role
  primaryDepartmentId?: string | null
  primaryDepartment?: DepartmentLike | null
}): Promise<UserAccessContext> {
  const departmentLinks = await prisma.userDepartment.findMany({
    where: { userId: input.userId },
    select: {
      departmentId: true,
      department: { select: { id: true, code: true, name: true } },
    },
  })

  const userDepartmentIds = new Set<string>()
  if (input.primaryDepartmentId) userDepartmentIds.add(input.primaryDepartmentId)
  for (const link of departmentLinks) userDepartmentIds.add(link.departmentId)

  const departmentRecords = new Map<string, DepartmentLike>()
  if (input.primaryDepartment?.id) {
    departmentRecords.set(input.primaryDepartment.id, input.primaryDepartment)
  }
  for (const link of departmentLinks) {
    if (link.department?.id) {
      departmentRecords.set(link.department.id, link.department)
    }
  }

  const userSetorKeys = resolveUserSetorKeysFromDepartments(Array.from(departmentRecords.values()))

  return {
    userId: input.userId,
    role: input.role,
    userDepartmentIds: [...userDepartmentIds],
    userSetorKeys,
  }
}

export function buildReceivedWhereByPolicy(ctx: UserAccessContext): Prisma.SolicitationWhereInput {
  return buildReceivedSolicitationVisibilityWhere({
    userId: ctx.userId,
    role: ctx.role,
    userDepartmentIds: ctx.userDepartmentIds,
    userSetorKeys: ctx.userSetorKeys,
  })
}

export function canViewSolicitation(ctx: UserAccessContext, solicitation: SolicitationLike) {
  return canUserViewSolicitationByDepartment(ctx, solicitation)
}

function canUserActOnCurrentStage(ctx: UserAccessContext, solicitation: SolicitationLike) {
  if (ctx.role === 'ADMIN') return true
  if (solicitation.departmentId && ctx.userDepartmentIds.includes(solicitation.departmentId)) {
    return true
  }

  const solicitationSetores = new Set(
    (solicitation.solicitacaoSetores ?? [])
      .map((setor) => setor.setor)
      .filter((setor): setor is string => Boolean(setor)),
  )

  if (solicitationSetores.size > 0) {
    for (const userSetor of ctx.userSetorKeys) {
      if (solicitationSetores.has(userSetor)) return true
    }
  }

  return false
}

export function canAssumeSolicitation(ctx: UserAccessContext, solicitation: SolicitationLike) {
  return canViewSolicitation(ctx, solicitation) && canUserActOnCurrentStage(ctx, solicitation)
}

export function canFinalizeSolicitation(ctx: UserAccessContext, solicitation: SolicitationLike) {
  return canViewSolicitation(ctx, solicitation) && canUserActOnCurrentStage(ctx, solicitation)
}
