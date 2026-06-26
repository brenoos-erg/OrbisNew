import { ModuleLevel, Prisma, Role } from '@prisma/client'
import { prisma } from './prisma'
import {
  EXPERIENCE_EVALUATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
} from './experienceEvaluation.constants'
import { isNadaConstaAllSectorsCompleted, isSolicitacaoExamesSst, isSolicitacaoNadaConsta, resolveNadaConstaSetoresByDepartment } from './solicitationTypes'
import { canUserViewSolicitationByFallback, type SolicitationVisibilityUserContext } from './solicitationVisibility'
import { isExperienceEvaluationEvaluator } from './experienceEvaluation.shared'
import { EXPERIENCE_EVALUATION_FINALIZATION_STATUS, EXPERIENCE_EVALUATION_VISIBLE_STATUSES, EXPERIENCE_EVALUATOR_GROUP_NAME } from './experienceEvaluation.constants'

type VisibilityUser = {
  id: string
  role?: string | null
}

type DepartmentLike = {
  id?: string | null
  code?: string | null
  name?: string | null
}

type CostCenterLike = {
  id?: string | null
  code?: string | null
  externalCode?: string | null
  abbreviation?: string | null
  description?: string | null
  department?: DepartmentLike | null
}

const LEVEL_ORDER: ModuleLevel[] = [
  ModuleLevel.NIVEL_1,
  ModuleLevel.NIVEL_2,
  ModuleLevel.NIVEL_3,
]

function hasMinLevel(
  level: ModuleLevel | string | null | undefined,
  minLevel: ModuleLevel,
) {
  if (!level) return false
  return LEVEL_ORDER.indexOf(level as ModuleLevel) >= LEVEL_ORDER.indexOf(minLevel)
}

function normalize(value?: string | null) {
  return (
    value
      ?.toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase() ?? ''
  )
}

function isRhDpDepartment(department?: DepartmentLike | null) {
  const code = department?.code?.trim()
  const name = normalize(department?.name)
  return (
    code === '08' ||
    code === '17' ||
    name.includes('DEPARTAMENTO PESSOAL') ||
    name.includes('RECURSOS HUMANOS') ||
    name === 'RH' ||
    name === 'DP'
  )
}

function isRhDpCostCenter(costCenter?: CostCenterLike | null) {
  if (!costCenter) return false
  const text = normalize(
    [
      costCenter.code,
      costCenter.externalCode,
      costCenter.abbreviation,
      costCenter.description,
    ]
      .filter(Boolean)
      .join(' '),
  )
  return (
    isRhDpDepartment(costCenter.department) ||
    text.includes('RECURSOS HUMANOS') ||
    text.includes('DEPARTAMENTO PESSOAL') ||
    /\bRH\b/.test(text) ||
    /\bDP\b/.test(text)
  )
}

function addValue(target: Set<string>, value?: string | null) {
  if (value) target.add(value)
}

function mergeAnd(
  baseWhere: Prisma.SolicitationWhereInput,
  clause: Prisma.SolicitationWhereInput,
): Prisma.SolicitationWhereInput {
  const { AND, ...rest } = baseWhere
  const clauses = Array.isArray(AND) ? AND : AND ? [AND] : []
  return {
    ...rest,
    AND: [...clauses, clause],
  }
}

function notPendingRq063Where(): Prisma.SolicitationWhereInput {
  return {
    NOT: {
      AND: [
        { requiresApproval: true },
        { approvalStatus: 'PENDENTE' },
        { tipo: { nome: 'RQ_063 - Solicitação de Pessoal' } },
      ],
    },
  }
}

export async function buildSolicitationVisibilityContext(
  user: VisibilityUser,
): Promise<SolicitationVisibilityUserContext> {
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      login: true,
      email: true,
      fullName: true,
      role: true,
      costCenterId: true,
      departmentId: true,
      costCenter: {
        select: {
          id: true,
          code: true,
          externalCode: true,
          abbreviation: true,
          description: true,
          department: { select: { id: true, code: true, name: true } },
        },
      },
      department: { select: { id: true, code: true, name: true } },
      costCenters: {
        select: {
          costCenterId: true,
          costCenter: {
            select: {
              id: true,
              code: true,
              externalCode: true,
              abbreviation: true,
              description: true,
              department: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
      userDepartments: {
        select: {
          departmentId: true,
          department: { select: { id: true, code: true, name: true } },
        },
      },
      moduleAccesses: {
        select: {
          level: true,
          module: { select: { key: true } },
        },
      },
    },
  })

  const departmentIds = new Set<string>()
  const costCenterIds = new Set<string>()
  const sharedRhDpDepartmentIds = new Set<string>()
  const sharedRhDpCostCenterIds = new Set<string>()
  const nadaConstaSetores = new Set<string>()

  const departments: DepartmentLike[] = []
  if (record?.department) departments.push(record.department)
  for (const link of record?.userDepartments ?? []) {
    departments.push(link.department)
  }

  for (const department of departments) {
    addValue(departmentIds, department.id)
    for (const setor of resolveNadaConstaSetoresByDepartment(department)) {
      nadaConstaSetores.add(setor)
    }
    if (isRhDpDepartment(department)) {
      addValue(sharedRhDpDepartmentIds, department.id)
    }
  }

  const costCenters: CostCenterLike[] = []
  if (record?.costCenter) costCenters.push(record.costCenter)
  for (const link of record?.costCenters ?? []) {
    if (link.costCenter) costCenters.push(link.costCenter)
  }

  for (const costCenter of costCenters) {
    addValue(costCenterIds, costCenter.id)
    if (isRhDpCostCenter(costCenter)) {
      addValue(sharedRhDpCostCenterIds, costCenter.id)
      addValue(sharedRhDpDepartmentIds, costCenter.department?.id)
    }
  }

  let solicitationModuleLevel: ModuleLevel | null = null
  let configuracoesModuleLevel: ModuleLevel | null = null

  for (const access of record?.moduleAccesses ?? []) {
    const key = access.module.key
    if (key === 'solicitacoes') {
      solicitationModuleLevel = access.level
    }
    if (key === 'configuracoes') {
      configuracoesModuleLevel = access.level
    }
  }

  const [finalizerRows, viewerTipoRows, approverTipoRows, evaluatorGroupMember] = await Promise.all([
    prisma.tipoSolicitacaoApprover.findMany({
      where: { userId: user.id, role: 'FINALIZER' },
      select: { tipoId: true },
    }),
    prisma.tipoSolicitacaoApprover.findMany({
      where: { userId: user.id, role: 'VIEWER' },
      select: { tipoId: true },
    }),
    prisma.tipoSolicitacaoApprover.findMany({
      where: { userId: user.id, role: 'APPROVER' },
      select: { tipoId: true },
    }),
    prisma.approverGroupMember.findFirst({
      where: { userId: user.id, group: { name: EXPERIENCE_EVALUATOR_GROUP_NAME } },
      select: { userId: true },
    }),
  ])

  const isAdminTechnical =
    record?.role === 'ADMIN' ||
    user.role === 'ADMIN' ||
    hasMinLevel(solicitationModuleLevel, ModuleLevel.NIVEL_3) ||
    hasMinLevel(configuracoesModuleLevel, ModuleLevel.NIVEL_3)

  return {
    userId: user.id,
    login: record?.login ?? null,
    email: record?.email ?? null,
    fullName: record?.fullName ?? null,
    role: record?.role ?? user.role ?? null,
    departmentIds: [...departmentIds],
    costCenterIds: [...costCenterIds],
    nadaConstaSetores: [...nadaConstaSetores],
    sharedRhDpDepartmentIds: [...sharedRhDpDepartmentIds],
    sharedRhDpCostCenterIds: [...sharedRhDpCostCenterIds],
    tipoApproverTipoIds: approverTipoRows.map((row) => row.tipoId),
    tipoViewerTipoIds: viewerTipoRows.map((row) => row.tipoId),
    tipoFinalizerTipoIds: finalizerRows.map((row) => row.tipoId),
    isExperienceEvaluationCoordinator: Boolean(evaluatorGroupMember),
    isRhAuthorizedForExperienceEvaluation: sharedRhDpDepartmentIds.size > 0 || sharedRhDpCostCenterIds.size > 0,
    isRhAuthorizedForSharedHiringFlow: sharedRhDpDepartmentIds.size > 0 || sharedRhDpCostCenterIds.size > 0,
    hasSolicitationsModuleAccess: Boolean(solicitationModuleLevel || record?.role === 'ADMIN' || user.role === 'ADMIN'),
    solicitationModuleLevel,
    configuracoesModuleLevel,
    isAdminTechnical,
  }
}

function addExperienceEvaluationEvaluatorJsonFilters(
  target: Prisma.SolicitationWhereInput[],
  ctx: SolicitationVisibilityUserContext,
) {
  const identities = [
    {
      value: ctx.userId,
      fields: ['gestorImediatoAvaliadorId', 'avaliadorId', 'gestorId'],
    },
    {
      value: ctx.login,
      fields: ['gestorImediatoAvaliadorLogin', 'avaliadorLogin', 'gestorLogin'],
    },
    {
      value: ctx.email,
      fields: ['gestorImediatoAvaliadorEmail', 'avaliadorEmail', 'gestorEmail'],
    },
    {
      value: ctx.fullName,
      fields: ['gestorImediatoAvaliador', 'avaliador', 'gestor'],
    },
  ]

  const payloadSections = ['campos', 'metadata', 'requestData', 'dynamicForm']
  const identityFilters = identities.flatMap(({ value, fields }) => {
    const normalizedValue = String(value ?? '').trim()
    if (!normalizedValue) return []

    return fields.flatMap((field) =>
  payloadSections.map((section) => ({
    payload: {
      path: `$.${section}.${field}`,
      equals: normalizedValue,
    },
  })),
)
  })

  if (!identityFilters.length) return

  target.push({
    tipoId: EXPERIENCE_EVALUATION_TIPO_ID,
    status: EXPERIENCE_EVALUATION_STATUS,
    OR: identityFilters,
  })
}

export function buildReceivedWhereByPolicy(
  ctx: SolicitationVisibilityUserContext,
  baseWhere: Prisma.SolicitationWhereInput = {},
  options: { excludePendingRq063?: boolean } = {},
): Prisma.SolicitationWhereInput {
  const receivedFilters: Prisma.SolicitationWhereInput[] = []

  receivedFilters.push({ assumidaPorId: ctx.userId })
  receivedFilters.push({ approverId: ctx.userId })
  addExperienceEvaluationEvaluatorJsonFilters(receivedFilters, ctx)

  if (ctx.departmentIds?.length) {
    receivedFilters.push({ departmentId: { in: ctx.departmentIds as string[] } })
  }

  if (ctx.costCenterIds?.length) {
    receivedFilters.push({ costCenterId: { in: ctx.costCenterIds as string[] } })
  }

  if (ctx.nadaConstaSetores?.length) {
    receivedFilters.push({
      solicitacaoSetores: {
        some: { setor: { in: ctx.nadaConstaSetores as string[] } },
      },
    })
  }

  if (ctx.tipoApproverTipoIds?.length) {
    receivedFilters.push({ tipoId: { in: ctx.tipoApproverTipoIds as string[] } })
  }

  if (ctx.tipoViewerTipoIds?.length) {
    receivedFilters.push({ tipoId: { in: ctx.tipoViewerTipoIds as string[] } })
  }

  if (ctx.tipoFinalizerTipoIds?.length) {
    receivedFilters.push({ tipoId: { in: ctx.tipoFinalizerTipoIds as string[] } })
  }

  if (ctx.sharedRhDpDepartmentIds?.length) {
    receivedFilters.push({
      departmentId: { in: ctx.sharedRhDpDepartmentIds as string[] },
    })
  }

  if (ctx.sharedRhDpCostCenterIds?.length) {
    receivedFilters.push({
      costCenterId: { in: ctx.sharedRhDpCostCenterIds as string[] },
    })
  }

  let where =
    receivedFilters.length > 0
      ? mergeAnd(baseWhere, { OR: receivedFilters })
      : mergeAnd(baseWhere, { id: '__never__' })

  if (options.excludePendingRq063) {
    where = mergeAnd(where, notPendingRq063Where())
  }

  return where
}

export type UserAccessContext = SolicitationVisibilityUserContext & {
  userLogin?: string | null
  userEmail?: string | null
  userFullName?: string | null
  role: Role | string
  userDepartmentIds?: string[]
  userCostCenterIds?: string[]
  userDepartmentNamesNormalized?: string[]
  userSectorNamesNormalized?: string[]
  userSetorKeys?: string[]
  finalizerTipoIds?: string[]
  allowedTipoIds?: string[]
  viewerTipoIds?: string[]
  actionableTipoIds?: string[]
  isExperienceEvaluationCoordinator?: boolean
  isRhAuthorizedForExperienceEvaluation?: boolean
  isRhAuthorizedForSharedHiringFlow?: boolean
  hasSolicitationsModuleAccess?: boolean
}

export type SolicitationAccessLike = {
  tipoId?: string | null
  tipo?: { id?: string | null; codigo?: string | null; nome?: string | null } | null
  status?: string | null
  solicitanteId?: string | null
  approverId?: string | null
  assumidaPorId?: string | null
  departmentId?: string | null
  costCenterId?: string | null
  solicitacaoSetores?: { setor?: string | null; status?: string | null; constaFlag?: unknown }[]
  payload?: unknown
}

function contextUserLogin(ctx: UserAccessContext) { return ctx.userLogin ?? ctx.login ?? null }
function contextUserEmail(ctx: UserAccessContext) { return ctx.userEmail ?? ctx.email ?? null }
function contextUserFullName(ctx: UserAccessContext) { return ctx.userFullName ?? ctx.fullName ?? null }
function contextDepartmentIds(ctx: UserAccessContext) { return ctx.userDepartmentIds ?? (ctx.departmentIds?.filter(Boolean) as string[] | undefined) ?? [] }
function contextCostCenterIds(ctx: UserAccessContext) { return ctx.userCostCenterIds ?? (ctx.costCenterIds?.filter(Boolean) as string[] | undefined) ?? [] }
function contextSetorKeys(ctx: UserAccessContext) { return ctx.userSetorKeys ?? (ctx.nadaConstaSetores?.filter(Boolean) as string[] | undefined) ?? [] }
function contextAllowedTipoIds(ctx: UserAccessContext) { return ctx.allowedTipoIds ?? (ctx.tipoApproverTipoIds?.filter(Boolean) as string[] | undefined) ?? [] }
function contextViewerTipoIds(ctx: UserAccessContext) { return ctx.viewerTipoIds ?? (ctx.tipoViewerTipoIds?.filter(Boolean) as string[] | undefined) ?? [] }
function contextFinalizerTipoIds(ctx: UserAccessContext) { return ctx.finalizerTipoIds ?? (ctx.tipoFinalizerTipoIds?.filter(Boolean) as string[] | undefined) ?? [] }
function contextActionableTipoIds(ctx: UserAccessContext) { return ctx.actionableTipoIds ?? (ctx.tipoApproverTipoIds?.filter(Boolean) as string[] | undefined) ?? [] }

export async function resolveUserAccessContext(input: {
  userId: string
  userLogin?: string | null
  userEmail?: string | null
  userFullName?: string | null
  role: Role | string
  primaryDepartmentId?: string | null
  primaryDepartment?: DepartmentLike | null
}): Promise<UserAccessContext> {
  const base = await buildSolicitationVisibilityContext({ id: input.userId, role: input.role })
  return {
    ...base,
    userLogin: input.userLogin ?? base.login,
    userEmail: input.userEmail ?? base.email,
    userFullName: input.userFullName ?? base.fullName,
    role: input.role ?? base.role ?? 'COLABORADOR',
    userDepartmentIds: base.departmentIds?.filter(Boolean) as string[],
    userCostCenterIds: base.costCenterIds?.filter(Boolean) as string[],
    userDepartmentNamesNormalized: [],
    userSectorNamesNormalized: [],
    userSetorKeys: base.nadaConstaSetores?.filter(Boolean) as string[],
    finalizerTipoIds: base.tipoFinalizerTipoIds?.filter(Boolean) as string[],
    allowedTipoIds: [
      ...(base.tipoApproverTipoIds?.filter(Boolean) as string[]),
      ...(base.tipoViewerTipoIds?.filter(Boolean) as string[]),
      ...(base.tipoFinalizerTipoIds?.filter(Boolean) as string[]),
    ],
    viewerTipoIds: base.tipoViewerTipoIds?.filter(Boolean) as string[],
    actionableTipoIds: base.tipoApproverTipoIds?.filter(Boolean) as string[],
    isExperienceEvaluationCoordinator: base.isExperienceEvaluationCoordinator ?? false,
    isRhAuthorizedForExperienceEvaluation: base.isRhAuthorizedForExperienceEvaluation ?? false,
    isRhAuthorizedForSharedHiringFlow: base.isRhAuthorizedForSharedHiringFlow ?? Boolean(base.sharedRhDpDepartmentIds?.length || base.sharedRhDpCostCenterIds?.length),
    hasSolicitationsModuleAccess: base.hasSolicitationsModuleAccess ?? Boolean(base.solicitationModuleLevel || input.role === 'ADMIN'),
  }
}

function hasTipoAccess(tipoIds: string[] | undefined, solicitation: SolicitationAccessLike) {
  return Boolean(solicitation.tipoId && tipoIds?.includes(solicitation.tipoId))
}

function isAdmin(ctx: UserAccessContext) { return ctx.role === 'ADMIN' || ctx.isAdminTechnical === true }

function canUserActAsExperienceEvaluator(ctx: UserAccessContext, solicitation: SolicitationAccessLike) {
  if (isAdmin(ctx)) return true
  if (solicitation.tipoId !== EXPERIENCE_EVALUATION_TIPO_ID) return false
  if (!EXPERIENCE_EVALUATION_VISIBLE_STATUSES.includes(solicitation.status as never)) return false
  if (ctx.isExperienceEvaluationCoordinator) return true
  return isExperienceEvaluationEvaluator(
    { payload: solicitation.payload, approverId: solicitation.approverId },
    { id: ctx.userId, login: contextUserLogin(ctx), email: contextUserEmail(ctx), fullName: contextUserFullName(ctx) },
  )
}

function canUserActOnCurrentStage(ctx: UserAccessContext, solicitation: SolicitationAccessLike) {
  if (isAdmin(ctx)) return true
  if (solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID) return false
  if (solicitation.departmentId && contextDepartmentIds(ctx).includes(solicitation.departmentId)) return true
  const setores = new Set((solicitation.solicitacaoSetores ?? []).map((s) => s.setor).filter((s): s is string => Boolean(s)))
  if (setores.size > 0 && contextSetorKeys(ctx).some((setor) => setores.has(setor))) return true
  return Boolean(solicitation.tipoId && contextActionableTipoIds(ctx).includes(solicitation.tipoId))
}

function canUserActAsFinalizerForCurrentStage(ctx: UserAccessContext, solicitation: SolicitationAccessLike) {
  if (isAdmin(ctx)) return true
  return Boolean(
    solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID &&
      solicitation.status === EXPERIENCE_EVALUATION_FINALIZATION_STATUS &&
      (contextFinalizerTipoIds(ctx).includes(solicitation.tipoId) ||
        ctx.isExperienceEvaluationCoordinator ||
        ctx.isRhAuthorizedForExperienceEvaluation),
  )
}

export function canViewSolicitation(ctx: UserAccessContext, solicitation: SolicitationAccessLike) {
  if (isAdmin(ctx)) return true
  if (hasTipoAccess(contextAllowedTipoIds(ctx), solicitation) || hasTipoAccess(contextViewerTipoIds(ctx), solicitation) || hasTipoAccess(contextFinalizerTipoIds(ctx), solicitation)) return true
  if (solicitation.solicitanteId === ctx.userId || solicitation.assumidaPorId === ctx.userId || solicitation.approverId === ctx.userId) return true
  if (canUserActAsExperienceEvaluator(ctx, solicitation) || canUserActAsFinalizerForCurrentStage(ctx, solicitation)) return true
  return canUserViewSolicitationByFallback({ ...ctx, departmentIds: contextDepartmentIds(ctx), costCenterIds: contextCostCenterIds(ctx), nadaConstaSetores: contextSetorKeys(ctx), tipoApproverTipoIds: contextActionableTipoIds(ctx), tipoViewerTipoIds: contextViewerTipoIds(ctx), tipoFinalizerTipoIds: contextFinalizerTipoIds(ctx) }, solicitation).canView
}

export function isViewerOnlyByPolicy(ctx: UserAccessContext, solicitation: SolicitationAccessLike) {
  if (isAdmin(ctx)) return false
  return Boolean(solicitation.tipoId && contextViewerTipoIds(ctx).includes(solicitation.tipoId) && !contextActionableTipoIds(ctx).includes(solicitation.tipoId) && !contextFinalizerTipoIds(ctx).includes(solicitation.tipoId) && !canUserActAsExperienceEvaluator(ctx, solicitation) && !canUserActAsFinalizerForCurrentStage(ctx, solicitation) && !canUserActOnCurrentStage(ctx, { ...solicitation, tipoId: null }))
}

export function canAssumeSolicitation(ctx: UserAccessContext, solicitation: SolicitationAccessLike) {
  return !isViewerOnlyByPolicy(ctx, solicitation) && canViewSolicitation(ctx, solicitation) && (canUserActOnCurrentStage(ctx, solicitation) || canUserActAsFinalizerForCurrentStage(ctx, solicitation))
}
export function canApproveSolicitation(ctx: UserAccessContext, solicitation: SolicitationAccessLike) {
  if (isViewerOnlyByPolicy(ctx, solicitation)) return false
  if (isAdmin(ctx)) return true
  return Boolean(canViewSolicitation(ctx, solicitation) && solicitation.tipoId && (contextActionableTipoIds(ctx).includes(solicitation.tipoId) || solicitation.approverId === ctx.userId))
}
export function canEditSolicitation(ctx: UserAccessContext, solicitation: SolicitationAccessLike) { return !isViewerOnlyByPolicy(ctx, solicitation) && canViewSolicitation(ctx, solicitation) && canUserActOnCurrentStage(ctx, solicitation) }
export function canCommentSolicitation(ctx: UserAccessContext, solicitation: SolicitationAccessLike) { return canEditSolicitation(ctx, solicitation) }

const REQUESTER_EDIT_BLOCKED_STATUSES = new Set(['CONCLUIDA', 'CONCLUIDA', 'FINALIZADA', 'FINALIZADO', 'CANCELADA', 'CANCELADO', 'ENCERRADA', 'ENCERRADO'])
function normalizeStatusForRequesterEdit(status?: string | null) { return (status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase() }
export function isRequesterEditableStatus(status?: string | null) { const normalized = normalizeStatusForRequesterEdit(status); return Boolean(normalized) && !REQUESTER_EDIT_BLOCKED_STATUSES.has(normalized) }
export function canRequesterEditRq092AfterSubmit(userId: string | null | undefined, solicitation: Pick<SolicitationAccessLike, 'tipoId' | 'tipo' | 'solicitanteId' | 'status'>) {
  if (!userId || solicitation.solicitanteId !== userId) return false
  if (!isSolicitacaoExamesSst({ id: solicitation.tipo?.id ?? solicitation.tipoId ?? null, codigo: solicitation.tipo?.codigo ?? null, nome: solicitation.tipo?.nome ?? null })) return false
  return isRequesterEditableStatus(solicitation.status)
}

export function canCancelSolicitation(ctx: UserAccessContext, solicitation: SolicitationAccessLike) { return !isViewerOnlyByPolicy(ctx, solicitation) && Boolean(ctx.hasSolicitationsModuleAccess ?? true) && canViewSolicitation(ctx, solicitation) }
export function canManageCancellationRequest(ctx: UserAccessContext, solicitation: SolicitationAccessLike) { return !isViewerOnlyByPolicy(ctx, solicitation) && canViewSolicitation(ctx, solicitation) && (isAdmin(ctx) || solicitation.assumidaPorId === ctx.userId || canUserActOnCurrentStage(ctx, solicitation) || canUserActAsFinalizerForCurrentStage(ctx, solicitation)) }
export function canFinalizeNadaConstaGlobal(ctx: UserAccessContext, solicitation: SolicitationAccessLike) {
  if (!isSolicitacaoNadaConsta({ id: solicitation.tipo?.id ?? solicitation.tipoId ?? null, codigo: solicitation.tipo?.codigo ?? null, nome: solicitation.tipo?.nome ?? null })) return false
  if (!isNadaConstaAllSectorsCompleted(solicitation.solicitacaoSetores)) return false
  return isAdmin(ctx) || ctx.role === 'DP' || hasTipoAccess(contextFinalizerTipoIds(ctx), solicitation) || contextSetorKeys(ctx).includes('DP') || (ctx.userDepartmentNamesNormalized ?? []).some((name) => name.includes('departamento pessoal') || name.includes('pessoal'))
}
export function canFinalizeSolicitation(ctx: UserAccessContext, solicitation: SolicitationAccessLike) {
  const isExperienceFinalizationStage = solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID && solicitation.status === EXPERIENCE_EVALUATION_FINALIZATION_STATUS
  if (isExperienceFinalizationStage && !isAdmin(ctx)) return !isViewerOnlyByPolicy(ctx, solicitation) && canViewSolicitation(ctx, solicitation) && canUserActAsFinalizerForCurrentStage(ctx, solicitation) && solicitation.approverId !== ctx.userId
  return !isViewerOnlyByPolicy(ctx, solicitation) && canViewSolicitation(ctx, solicitation) && (canUserActOnCurrentStage(ctx, solicitation) || canUserActAsFinalizerForCurrentStage(ctx, solicitation) || canFinalizeNadaConstaGlobal(ctx, solicitation))
}
export function canPrintExperienceEvaluationPdf(ctx: UserAccessContext, solicitation: SolicitationAccessLike) {
  if (solicitation.tipoId !== EXPERIENCE_EVALUATION_TIPO_ID) return false
  if (solicitation.status !== EXPERIENCE_EVALUATION_FINALIZATION_STATUS && solicitation.status !== 'CONCLUIDA' && solicitation.status !== 'FINALIZADA') return false
  if (isAdmin(ctx) || contextFinalizerTipoIds(ctx).includes(EXPERIENCE_EVALUATION_TIPO_ID) || ctx.isExperienceEvaluationCoordinator || ctx.isRhAuthorizedForExperienceEvaluation) return true
  if (canUserActAsExperienceEvaluator(ctx, solicitation)) return true
  return canViewSolicitation(ctx, solicitation)
}
