import { ModuleLevel, Prisma, Role } from '@prisma/client'
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
  EXPERIENCE_EVALUATION_VISIBLE_STATUSES,
} from '@/lib/experienceEvaluation'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { isRhDepartment } from '@/lib/rhAccess'

export type UserAccessContext = {
  userId: string
  userLogin?: string | null
  userEmail?: string | null
  userFullName?: string | null
  role: Role
  userDepartmentIds: string[]
  userCostCenterIds: string[]
  userDepartmentNamesNormalized: string[]
  userSectorNamesNormalized: string[]
  userSetorKeys: string[]
  finalizerTipoIds: string[]
  allowedTipoIds: string[]
  viewerTipoIds: string[]
  actionableTipoIds: string[]
  isExperienceEvaluationCoordinator: boolean
  isRhAuthorizedForExperienceEvaluation: boolean
  hasSolicitationsModuleAccess: boolean
}

type DepartmentLike = { id?: string | null; code?: string | null; sigla?: string | null; name?: string | null }

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
      department: { select: { id: true, code: true, sigla: true, name: true } },
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

  const userDepartments = Array.from(departmentRecords.values())
  const userSetorKeys = resolveUserSetorKeysFromDepartments(userDepartments)
  const [finalizerRows, viewerTipoRows, approverTipoRows, evaluatorGroupMember, solicitationModuleAccess] = await Promise.all([
    prisma.tipoSolicitacaoApprover.findMany({
      where: { userId: input.userId, role: 'FINALIZER' },
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
    prisma.userModuleAccess.findFirst({
      where: {
        userId: input.userId,
        level: { in: [ModuleLevel.NIVEL_1, ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3] },
        module: { key: MODULE_KEYS.SOLICITACOES },
      },
      select: { id: true },
    }),
  ])

  const hasSolicitationsModuleAccess = input.role === 'ADMIN' || Boolean(solicitationModuleAccess)
  const userCostCenterIds = new Set<string>()
  const userCostCenterLinks = await prisma.userCostCenter.findMany({ where: { userId: input.userId }, select: { costCenterId: true } })
  if (input.primaryDepartmentId) {
    const primaryUser = await prisma.user.findUnique({ where: { id: input.userId }, select: { costCenterId: true } })
    if (primaryUser?.costCenterId) userCostCenterIds.add(primaryUser.costCenterId)
  }
  for (const link of userCostCenterLinks) userCostCenterIds.add(link.costCenterId)
  const normalizeName = (value: unknown) => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  const userDepartmentNamesNormalized = userDepartments.map((department) => normalizeName(department.name)).filter(Boolean)
  const userSectorNamesNormalized = Array.from(new Set([...userSetorKeys.map((key) => normalizeName(key)), ...userDepartmentNamesNormalized]))
  const isRhAuthorizedForExperienceEvaluation =
    hasSolicitationsModuleAccess &&
    (input.role === 'RH' || userDepartments.some((department) => isRhDepartment(department)))

  return {
    userId: input.userId,
    userLogin: input.userLogin,
    userEmail: input.userEmail,
    userFullName: input.userFullName,
    role: input.role,
    userDepartmentIds: [...userDepartmentIds],
    userCostCenterIds: [...userCostCenterIds],
    userDepartmentNamesNormalized,
    userSectorNamesNormalized,
    userSetorKeys,
    finalizerTipoIds: finalizerRows.map((row) => row.tipoId),
    allowedTipoIds: [],
    viewerTipoIds: Array.from(new Set(viewerTipoRows.map((row) => row.tipoId))),
    actionableTipoIds: Array.from(new Set(approverTipoRows.map((row) => row.tipoId))),
    isExperienceEvaluationCoordinator: Boolean(evaluatorGroupMember),
    isRhAuthorizedForExperienceEvaluation,
    hasSolicitationsModuleAccess,
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
    userCostCenterIds: ctx.userCostCenterIds,
    userDepartmentNamesNormalized: ctx.userDepartmentNamesNormalized,
    userSectorNamesNormalized: ctx.userSectorNamesNormalized,
    userSetorKeys: ctx.userSetorKeys,
    finalizerTipoIds: ctx.finalizerTipoIds,
    allowedTipoIds: ctx.allowedTipoIds,
    viewerTipoIds: ctx.viewerTipoIds,
    isExperienceEvaluationCoordinator: ctx.isExperienceEvaluationCoordinator,
    isRhAuthorizedForExperienceEvaluation: ctx.isRhAuthorizedForExperienceEvaluation,
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
  if (!EXPERIENCE_EVALUATION_VISIBLE_STATUSES.includes(solicitation.status as any)) return false
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
    (ctx.finalizerTipoIds.includes(solicitation.tipoId) ||
      ctx.isExperienceEvaluationCoordinator ||
      ctx.isRhAuthorizedForExperienceEvaluation)
  )
}


export function canPrintExperienceEvaluationPdf(ctx: UserAccessContext, solicitation: SolicitationLike) {
  if (solicitation.tipoId !== EXPERIENCE_EVALUATION_TIPO_ID) return false
  if (
    solicitation.status !== EXPERIENCE_EVALUATION_FINALIZATION_STATUS &&
    solicitation.status !== 'CONCLUIDA' &&
    solicitation.status !== 'FINALIZADA'
  ) {
    return false
  }

  if (ctx.role === 'ADMIN') return true
  if (
    ctx.finalizerTipoIds.includes(EXPERIENCE_EVALUATION_TIPO_ID) ||
    ctx.isExperienceEvaluationCoordinator ||
    ctx.isRhAuthorizedForExperienceEvaluation
  ) {
    return true
  }

  if (
    isExperienceEvaluationEvaluator(
      { payload: solicitation.payload, approverId: solicitation.approverId },
      {
        id: ctx.userId,
        login: ctx.userLogin,
        email: ctx.userEmail,
        fullName: ctx.userFullName,
      },
    )
  ) {
    return true
  }

  return canViewSolicitation(ctx, solicitation)
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
  if (isViewerOnlyByPolicy(ctx, solicitation)) return false
  return ctx.hasSolicitationsModuleAccess && canViewSolicitation(ctx, solicitation)
}

export function canManageCancellationRequest(ctx: UserAccessContext, solicitation: SolicitationLike) {
  if (isViewerOnlyByPolicy(ctx, solicitation)) return false
  if (ctx.role === 'ADMIN') return canViewSolicitation(ctx, solicitation)
  return (
    canViewSolicitation(ctx, solicitation) &&
    (
      solicitation.assumidaPorId === ctx.userId ||
      canUserActOnCurrentStage(ctx, solicitation) ||
      canUserActAsFinalizerForCurrentStage(ctx, solicitation)
    )
  )
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
