import { Prisma, Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  buildReceivedSolicitationVisibilityWhere,
  canUserViewSolicitationByDepartment,
  resolveUserSetorKeysFromDepartments,
} from '@/lib/solicitationVisibility'
import {
  EXPERIENCE_EVALUATOR_GROUP_NAME,
  isExperienceEvaluationEvaluator,
  EXPERIENCE_EVALUATION_STATUS,
  EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
} from '@/lib/experienceEvaluation'

export type UserAccessContext = {
  userId: string
  userLogin?: string | null
  userEmail?: string | null
  userFullName?: string | null
  role: Role
  userDepartmentIds: string[]
  userSetorKeys: string[]
  finalizerTipoIds: string[]
  allowedTipoIds: string[]
  viewerTipoIds: string[]
  actionableTipoIds: string[]
  isExperienceEvaluationCoordinator: boolean
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
  payload?: unknown
}

export async function resolveUserAccessContext(input: {
  userId: string
  userLogin?: string | null
  userEmail?: string | null
  userFullName?: string | null
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
  const [finalizerRows, allowedTipoRows, viewerTipoRows, approverTipoRows, evaluatorGroupMember] = await Promise.all([
    prisma.tipoSolicitacaoApprover.findMany({
      where: { userId: input.userId, role: 'FINALIZER' },
      select: { tipoId: true },
    }),
    prisma.tipoSolicitacaoApprover.findMany({
      where: { userId: input.userId },
      select: { tipoId: true },
    }),
    prisma.tipoSolicitacaoApprover.findMany({
      where: { userId: input.userId, role: 'VIEWER' },
      select: { tipoId: true },
    }),
    prisma.tipoSolicitacaoApprover.findMany({
      where: { userId: input.userId, role: 'APPROVER' },
      select: { tipoId: true },
    }),
    prisma.approverGroupMember.findFirst({
      where: {
        userId: input.userId,
        group: { name: EXPERIENCE_EVALUATOR_GROUP_NAME },
      },
      select: { userId: true },
    }),
  ])

  return {
    userId: input.userId,
    userLogin: input.userLogin,
    userEmail: input.userEmail,
    userFullName: input.userFullName,
    role: input.role,
    userDepartmentIds: [...userDepartmentIds],
    userSetorKeys,
    finalizerTipoIds: finalizerRows.map((row) => row.tipoId),
    allowedTipoIds: Array.from(new Set(allowedTipoRows.map((row) => row.tipoId))),
    viewerTipoIds: Array.from(new Set(viewerTipoRows.map((row) => row.tipoId))),
    actionableTipoIds: Array.from(new Set(approverTipoRows.map((row) => row.tipoId))),
    isExperienceEvaluationCoordinator: Boolean(evaluatorGroupMember),
  }
}

export function buildReceivedWhereByPolicy(ctx: UserAccessContext): Prisma.SolicitationWhereInput {
  return buildReceivedSolicitationVisibilityWhere({
    userId: ctx.userId,
    userLogin: ctx.userLogin,
    userEmail: ctx.userEmail,
    userFullName: ctx.userFullName,
    role: ctx.role,
    userDepartmentIds: ctx.userDepartmentIds,
    userSetorKeys: ctx.userSetorKeys,
    finalizerTipoIds: ctx.finalizerTipoIds,
    allowedTipoIds: ctx.allowedTipoIds,
    isExperienceEvaluationCoordinator: ctx.isExperienceEvaluationCoordinator,
  })
}

export function canViewSolicitation(ctx: UserAccessContext, solicitation: SolicitationLike) {
  return (
    canUserViewSolicitationByDepartment(ctx, solicitation) ||
    canUserActAsExperienceEvaluator(ctx, solicitation) ||
    canUserActAsFinalizerForCurrentStage(ctx, solicitation)
  )
}

function canUserActAsExperienceEvaluator(ctx: UserAccessContext, solicitation: SolicitationLike) {
  if (ctx.role === 'ADMIN') return true
  if (solicitation.tipoId !== EXPERIENCE_EVALUATION_TIPO_ID) return false
  if (solicitation.status !== EXPERIENCE_EVALUATION_STATUS) return false
  if (ctx.isExperienceEvaluationCoordinator) return true

  return isExperienceEvaluationEvaluator(
    { payload: solicitation.payload, approverId: solicitation.approverId },
    {
      id: ctx.userId,
      login: ctx.userLogin,
      email: ctx.userEmail,
      fullName: ctx.userFullName,
    },
  )
}

function canUserActAsFinalizerForCurrentStage(ctx: UserAccessContext, solicitation: SolicitationLike) {
  if (ctx.role === 'ADMIN') return true
  if (!solicitation.tipoId || !solicitation.status) return false

  return (
    solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID &&
    solicitation.status === EXPERIENCE_EVALUATION_FINALIZATION_STATUS &&
    (ctx.finalizerTipoIds.includes(solicitation.tipoId) || ctx.isExperienceEvaluationCoordinator)
  )
}

export function canActOnSolicitation(ctx: UserAccessContext, solicitation: SolicitationLike) {
  return canViewSolicitation(ctx, solicitation) && canUserActOnCurrentStage(ctx, solicitation)
}

function canUserActOnCurrentStage(ctx: UserAccessContext, solicitation: SolicitationLike) {
  if (ctx.role === 'ADMIN') return true
  if (solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID) return false
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

  if (solicitation.tipoId && ctx.actionableTipoIds.includes(solicitation.tipoId)) {
    return true
  }

  return false
}

export function isViewerOnlyByPolicy(ctx: UserAccessContext, solicitation: SolicitationLike) {
  if (ctx.role === 'ADMIN') return false
  return Boolean(
    solicitation.tipoId &&
      ctx.viewerTipoIds.includes(solicitation.tipoId) &&
      !ctx.actionableTipoIds.includes(solicitation.tipoId) &&
      !ctx.finalizerTipoIds.includes(solicitation.tipoId) &&
      !canUserActAsExperienceEvaluator(ctx, solicitation) &&
      !canUserActAsFinalizerForCurrentStage(ctx, solicitation) &&
      !canUserActOnCurrentStage(ctx, { ...solicitation, tipoId: null }),
  )
}

export function canAssumeSolicitation(ctx: UserAccessContext, solicitation: SolicitationLike) {
  return (
    !isViewerOnlyByPolicy(ctx, solicitation) &&
    canViewSolicitation(ctx, solicitation) &&
    (canUserActOnCurrentStage(ctx, solicitation) || canUserActAsFinalizerForCurrentStage(ctx, solicitation))
  )
}

export function canApproveSolicitation(ctx: UserAccessContext, solicitation: SolicitationLike) {
  if (isViewerOnlyByPolicy(ctx, solicitation)) return false
  if (ctx.role === 'ADMIN') return true
  return Boolean(
    canViewSolicitation(ctx, solicitation) &&
      solicitation.tipoId &&
      (ctx.actionableTipoIds.includes(solicitation.tipoId) || solicitation.approverId === ctx.userId),
  )
}

export function canEditSolicitation(ctx: UserAccessContext, solicitation: SolicitationLike) {
  return !isViewerOnlyByPolicy(ctx, solicitation) && canActOnSolicitation(ctx, solicitation)
}

export function canCommentSolicitation(ctx: UserAccessContext, solicitation: SolicitationLike) {
  return canEditSolicitation(ctx, solicitation)
}

export function canCancelSolicitation(ctx: UserAccessContext, solicitation: SolicitationLike) {
  return ctx.role === 'ADMIN' && !isViewerOnlyByPolicy(ctx, solicitation) && canViewSolicitation(ctx, solicitation)
}

export function canFinalizeSolicitation(ctx: UserAccessContext, solicitation: SolicitationLike) {
  const isExperienceFinalizationStage =
    solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID &&
    solicitation.status === EXPERIENCE_EVALUATION_FINALIZATION_STATUS

  if (isExperienceFinalizationStage && ctx.role !== 'ADMIN') {
    return (
      !isViewerOnlyByPolicy(ctx, solicitation) &&
      canViewSolicitation(ctx, solicitation) &&
      canUserActAsFinalizerForCurrentStage(ctx, solicitation) &&
      solicitation.approverId !== ctx.userId
    )
  }

  return (
    !isViewerOnlyByPolicy(ctx, solicitation) &&
    canViewSolicitation(ctx, solicitation) &&
    (canUserActOnCurrentStage(ctx, solicitation) || canUserActAsFinalizerForCurrentStage(ctx, solicitation))
  )
}
