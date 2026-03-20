import { Prisma, Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  buildReceivedSolicitationVisibilityWhere,
  canUserViewSolicitationByDepartment,
  resolveUserSetorKeysFromDepartments,
} from '@/lib/solicitationVisibility'
import {
  EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
} from '@/lib/experienceEvaluation'

export type UserAccessContext = {
  userId: string
  role: Role
  userDepartmentIds: string[]
  userSetorKeys: string[]
  finalizerTipoIds: string[]
}

type DepartmentLike = { id?: string | null; code?: string | null; name?: string | null }

type SolicitationLike = {
  tipoId?: string | null
  status?: string | null
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
  const finalizerRows = await prisma.tipoSolicitacaoApprover.findMany({
    where: { userId: input.userId, role: 'FINALIZER' },
    select: { tipoId: true },
  })

  return {
    userId: input.userId,
    role: input.role,
    userDepartmentIds: [...userDepartmentIds],
    userSetorKeys,
    finalizerTipoIds: finalizerRows.map((row) => row.tipoId),
  }
}

export function buildReceivedWhereByPolicy(ctx: UserAccessContext): Prisma.SolicitationWhereInput {
  return buildReceivedSolicitationVisibilityWhere({
    userId: ctx.userId,
    role: ctx.role,
    userDepartmentIds: ctx.userDepartmentIds,
    userSetorKeys: ctx.userSetorKeys,
    finalizerTipoIds: ctx.finalizerTipoIds,
  })
}

export function canViewSolicitation(ctx: UserAccessContext, solicitation: SolicitationLike) {
  return (
    canUserViewSolicitationByDepartment(ctx, solicitation) ||
    canUserActAsFinalizerForCurrentStage(ctx, solicitation)
  )
}

function canUserActAsFinalizerForCurrentStage(ctx: UserAccessContext, solicitation: SolicitationLike) {
  if (ctx.role === 'ADMIN') return true
  if (!solicitation.tipoId || !solicitation.status) return false

  return (
    solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID &&
    solicitation.status === EXPERIENCE_EVALUATION_FINALIZATION_STATUS &&
    ctx.finalizerTipoIds.includes(solicitation.tipoId)
  )
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
  return (
    canViewSolicitation(ctx, solicitation) &&
    (canUserActOnCurrentStage(ctx, solicitation) || canUserActAsFinalizerForCurrentStage(ctx, solicitation))
  )
}

export function canFinalizeSolicitation(ctx: UserAccessContext, solicitation: SolicitationLike) {
  return (
    canViewSolicitation(ctx, solicitation) &&
    (canUserActOnCurrentStage(ctx, solicitation) || canUserActAsFinalizerForCurrentStage(ctx, solicitation))
  )
}
