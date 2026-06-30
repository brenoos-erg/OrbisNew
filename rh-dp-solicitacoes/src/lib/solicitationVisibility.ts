import { Prisma } from '@prisma/client'
import { resolveNadaConstaSetoresByDepartment } from './solicitationTypes'
import { EXPERIENCE_EVALUATION_FINALIZATION_STATUS, EXPERIENCE_EVALUATION_TIPO_ID, EXPERIENCE_EVALUATION_VISIBLE_STATUSES } from './experienceEvaluation.constants'

export type SolicitationVisibilityReason =
  | 'REQUESTER'
  | 'ASSIGNED_USER'
  | 'APPROVER'
  | 'CURRENT_DEPARTMENT'
  | 'CURRENT_COST_CENTER'
  | 'NADA_CONSTA_SECTOR'
  | 'TIPO_APPROVER'
  | 'TIPO_VIEWER'
  | 'TIPO_FINALIZER'
  | 'SHARED_RH_DP_FLOW'
  | 'LEGACY_FALLBACK'
  | 'ADMIN_TECHNICAL_FALLBACK'

export type SolicitationVisibilityResult = {
  canView: boolean
  reasons: SolicitationVisibilityReason[]
}

export type SolicitationVisibilityUserContext = {
  userId: string
  login?: string | null
  email?: string | null
  fullName?: string | null
  role?: string | null
  departmentIds?: Array<string | null | undefined>
  costCenterIds?: Array<string | null | undefined>
  nadaConstaSetores?: Array<string | null | undefined>
  tipoApproverTipoIds?: Array<string | null | undefined>
  tipoViewerTipoIds?: Array<string | null | undefined>
  tipoFinalizerTipoIds?: Array<string | null | undefined>
  sharedRhDpDepartmentIds?: Array<string | null | undefined>
  sharedRhDpCostCenterIds?: Array<string | null | undefined>
  solicitationModuleLevel?: string | null
  configuracoesModuleLevel?: string | null
  isAdminTechnical?: boolean
  isExperienceEvaluationCoordinator?: boolean
  isRhAuthorizedForExperienceEvaluation?: boolean
  isRhAuthorizedForSharedHiringFlow?: boolean
  hasSolicitationsModuleAccess?: boolean
}

export type SolicitationVisibilitySolicitation = {
  id?: string | null
  protocolo?: string | null
  tipoId?: string | null
  solicitanteId?: string | null
  assumidaPorId?: string | null
  approverId?: string | null
  departmentId?: string | null
  costCenterId?: string | null
  workflowSnapshotJson?: unknown | null
  approvalSnapshotJson?: unknown | null
  notificationSnapshotJson?: unknown | null
  tipo?: {
    id?: string | null
    nome?: string | null
  } | null
  solicitacaoSetores?: Array<{
    setor?: string | null
  }> | null
}

function toSet(values?: Array<string | null | undefined>) {
  return new Set(
    (values ?? [])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  )
}

function toUpperSet(values?: Array<string | null | undefined>) {
  return new Set([...toSet(values)].map((value) => value.toUpperCase()))
}

function hasSnapshotField(
  solicitation: SolicitationVisibilitySolicitation,
  field: 'workflowSnapshotJson' | 'approvalSnapshotJson' | 'notificationSnapshotJson',
) {
  return Object.prototype.hasOwnProperty.call(solicitation, field)
}

function isMissingLegacySnapshots(
  solicitation: SolicitationVisibilitySolicitation,
) {
  const snapshotFields = [
    'workflowSnapshotJson',
    'approvalSnapshotJson',
    'notificationSnapshotJson',
  ] as const

  const hasAnySnapshotField = snapshotFields.some((field) =>
    hasSnapshotField(solicitation, field),
  )

  if (!hasAnySnapshotField) return true

  return snapshotFields.some((field) => solicitation[field] == null)
}

function hasOperationalOwner(solicitation: SolicitationVisibilitySolicitation) {
  return Boolean(
    solicitation.solicitanteId ||
      solicitation.assumidaPorId ||
      solicitation.approverId ||
      solicitation.departmentId ||
      solicitation.costCenterId ||
      (solicitation.solicitacaoSetores?.length ?? 0) > 0,
  )
}

function pushReason(
  reasons: SolicitationVisibilityReason[],
  reason: SolicitationVisibilityReason,
) {
  if (!reasons.includes(reason)) {
    reasons.push(reason)
  }
}

export function canUserViewSolicitationByFallback(
  ctx: SolicitationVisibilityUserContext,
  solicitation: SolicitationVisibilitySolicitation,
): SolicitationVisibilityResult {
  const reasons: SolicitationVisibilityReason[] = []
  const departmentIds = toSet(ctx.departmentIds)
  const costCenterIds = toSet(ctx.costCenterIds)
  const nadaConstaSetores = toUpperSet(ctx.nadaConstaSetores)
  const tipoApproverTipoIds = toSet(ctx.tipoApproverTipoIds)
  const tipoViewerTipoIds = toSet(ctx.tipoViewerTipoIds)
  const tipoFinalizerTipoIds = toSet(ctx.tipoFinalizerTipoIds)
  const sharedRhDpDepartmentIds = toSet(ctx.sharedRhDpDepartmentIds)
  const sharedRhDpCostCenterIds = toSet(ctx.sharedRhDpCostCenterIds)

  if (solicitation.solicitanteId === ctx.userId) {
    pushReason(reasons, 'REQUESTER')
  }

  if (solicitation.assumidaPorId === ctx.userId) {
    pushReason(reasons, 'ASSIGNED_USER')
  }

  if (solicitation.approverId === ctx.userId) {
    pushReason(reasons, 'APPROVER')
  }

  if (
    solicitation.departmentId &&
    departmentIds.has(solicitation.departmentId)
  ) {
    pushReason(reasons, 'CURRENT_DEPARTMENT')
  }

  if (
    solicitation.costCenterId &&
    costCenterIds.has(solicitation.costCenterId)
  ) {
    pushReason(reasons, 'CURRENT_COST_CENTER')
  }

  if (
    nadaConstaSetores.size > 0 &&
    solicitation.solicitacaoSetores?.some((item) =>
      item.setor ? nadaConstaSetores.has(item.setor.toUpperCase()) : false,
    )
  ) {
    pushReason(reasons, 'NADA_CONSTA_SECTOR')
  }

  if (solicitation.tipoId && tipoApproverTipoIds.has(solicitation.tipoId)) {
    pushReason(reasons, 'TIPO_APPROVER')
  }

  if (solicitation.tipoId && tipoViewerTipoIds.has(solicitation.tipoId)) {
    pushReason(reasons, 'TIPO_VIEWER')
  }

  if (solicitation.tipoId && tipoFinalizerTipoIds.has(solicitation.tipoId)) {
    pushReason(reasons, 'TIPO_FINALIZER')
  }

  if (
    (solicitation.departmentId &&
      sharedRhDpDepartmentIds.has(solicitation.departmentId)) ||
    (solicitation.costCenterId &&
      sharedRhDpCostCenterIds.has(solicitation.costCenterId))
  ) {
    pushReason(reasons, 'SHARED_RH_DP_FLOW')
  }

  if (!hasOperationalOwner(solicitation) && ctx.isAdminTechnical) {
    pushReason(reasons, 'ADMIN_TECHNICAL_FALLBACK')
  }

  if (reasons.length > 0 && isMissingLegacySnapshots(solicitation)) {
    pushReason(reasons, 'LEGACY_FALLBACK')
  }

  return {
    canView: reasons.length > 0,
    reasons,
  }
}

export function resolveUserSetorKeysFromDepartments(
  departments: Array<{ id?: string | null; code?: string | null; sigla?: string | null; name?: string | null }>,
) {
  const setorKeys = new Set<string>()
  for (const department of departments) {
    for (const setor of resolveNadaConstaSetoresByDepartment(department)) {
      setorKeys.add(setor)
    }
  }
  return [...setorKeys]
}

export function buildRhSharedHiringFlowVisibilityWhere(): Prisma.SolicitationWhereInput {
  return {
    OR: [
      {
        OR: [
          { tipoId: 'RQ_063' },
          { tipo: { codigo: { in: ['RQ.RH.063', 'RQ.063', 'RQ.RH.001'] } } },
          { tipo: { nome: { contains: 'Solicitação de Pessoal' } } },
          { tipo: { nome: { contains: 'Solicitação de pessoal' } } },
        ],
      },
      {
        AND: [
          {
            OR: [
              { tipoId: 'SOLICITACAO_ADMISSAO' },
              { tipo: { codigo: { in: ['RQ.DP.001'] } } },
              { tipo: { nome: { contains: 'Solicitação de Admissão' } } },
              { tipo: { nome: { contains: 'Solicitação de admissão' } } },
            ],
          },
          {
            OR: [
              { parent: { tipoId: 'RQ_063' } },
              { parent: { tipo: { codigo: { in: ['RQ.RH.063', 'RQ.063', 'RQ.RH.001'] } } } },
              { payload: { path: '$.origem.rhSolicitationId', not: Prisma.JsonNull } },
              { payload: { path: '$.origem.rhProtocolo', not: Prisma.JsonNull } },
            ],
          },
        ],
      },
    ],
  }
}

type LegacyReceivedInput = {
  userId: string
  userLogin?: string | null
  userEmail?: string | null
  userFullName?: string | null
  role?: string | null
  userDepartmentIds?: string[]
  userCostCenterIds?: string[]
  userSetorKeys?: string[]
  userDepartmentNamesNormalized?: string[]
  userSectorNamesNormalized?: string[]
  finalizerTipoIds?: string[]
  allowedTipoIds?: string[]
  viewerTipoIds?: string[]
  isExperienceEvaluationCoordinator?: boolean
  isRhAuthorizedForExperienceEvaluation?: boolean
  isRhAuthorizedForSharedHiringFlow?: boolean
}

function buildExperienceEvaluatorPayloadFilters(input: LegacyReceivedInput) {
  const sections = ['campos', 'metadata', 'requestData', 'dynamicForm']
  const identities = [
    { value: input.userId, fields: ['gestorImediatoAvaliadorId', 'avaliadorId', 'gestorId'] },
    { value: input.userLogin, fields: ['gestorImediatoAvaliadorLogin', 'avaliadorLogin', 'gestorLogin'] },
    { value: input.userEmail, fields: ['gestorImediatoAvaliadorEmail', 'avaliadorEmail', 'gestorEmail'] },
    { value: input.userFullName, fields: ['gestorImediatoAvaliador', 'avaliador', 'gestor'] },
  ]
  return identities.flatMap(({ value, fields }) => {
    const normalizedValue = String(value ?? '').trim()
    if (!normalizedValue) return []
    return fields.flatMap((field) => sections.map((section) => ({ payload: { path: `$.${section}.${field}`, equals: normalizedValue } })))
  })
}

export function buildReceivedSolicitationVisibilityWhere(input: LegacyReceivedInput): Prisma.SolicitationWhereInput {
  if (input.role === 'ADMIN') return {}
  const regular: Prisma.SolicitationWhereInput[] = [{ assumidaPorId: input.userId }]
  if (input.userDepartmentIds?.length) regular.push({ departmentId: { in: input.userDepartmentIds } })
  if (input.userSetorKeys?.length) regular.push({ solicitacaoSetores: { some: { setor: { in: input.userSetorKeys } } } })
  if (input.viewerTipoIds?.length) regular.push({ tipoId: { in: input.viewerTipoIds } })
  if (input.isRhAuthorizedForSharedHiringFlow) regular.push(buildRhSharedHiringFlowVisibilityWhere())

  const evaluatorPayloadFilters = buildExperienceEvaluatorPayloadFilters(input)
  const orFilters: Prisma.SolicitationWhereInput[] = [
    { tipoId: { not: EXPERIENCE_EVALUATION_TIPO_ID }, OR: regular },
    {
      tipoId: EXPERIENCE_EVALUATION_TIPO_ID,
      status: { in: EXPERIENCE_EVALUATION_VISIBLE_STATUSES },
      OR: [
        { solicitanteId: input.userId },
        { approverId: input.userId },
        ...(input.isExperienceEvaluationCoordinator || input.isRhAuthorizedForExperienceEvaluation ? [{ id: { not: '' } }] : []),
        ...(input.viewerTipoIds?.includes(EXPERIENCE_EVALUATION_TIPO_ID) ? [{ id: { not: '' } }] : []),
        ...(evaluatorPayloadFilters.length ? evaluatorPayloadFilters : []),
      ],
    },
  ]
  if (input.finalizerTipoIds?.includes(EXPERIENCE_EVALUATION_TIPO_ID) || input.viewerTipoIds?.includes(EXPERIENCE_EVALUATION_TIPO_ID) || input.isExperienceEvaluationCoordinator || input.isRhAuthorizedForExperienceEvaluation) {
    orFilters.push({ tipoId: EXPERIENCE_EVALUATION_TIPO_ID, status: { in: [EXPERIENCE_EVALUATION_FINALIZATION_STATUS, 'CONCLUIDA'] } })
  }
  return { OR: orFilters }
}

function normalizeSharedFlowText(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
}

export function isSolicitacaoPessoalSharedFlowRecord(solicitation: {
  tipoId?: string | null
  tipo?: { codigo?: string | null; nome?: string | null } | null
}) {
  const tipoId = normalizeSharedFlowText(solicitation.tipoId)
  const codigo = normalizeSharedFlowText(solicitation.tipo?.codigo)
  const nome = normalizeSharedFlowText(solicitation.tipo?.nome)
  return tipoId === 'RQ_063' || ['RQ.RH.063', 'RQ.063', 'RQ.RH.001'].includes(codigo) || nome.includes('SOLICITACAO DE PESSOAL')
}

export function isLinkedAdmissionFromSharedHiringFlow(solicitation: {
  tipoId?: string | null
  parentId?: string | null
  payload?: unknown
  tipo?: { codigo?: string | null; nome?: string | null } | null
  parent?: { tipoId?: string | null; tipo?: { codigo?: string | null; nome?: string | null } | null } | null
}) {
  const tipoId = normalizeSharedFlowText(solicitation.tipoId)
  const codigo = normalizeSharedFlowText(solicitation.tipo?.codigo)
  const nome = normalizeSharedFlowText(solicitation.tipo?.nome)
  const isAdmission = tipoId === 'SOLICITACAO_ADMISSAO' || codigo === 'RQ.DP.001' || nome.includes('SOLICITACAO DE ADMISSAO')
  if (!isAdmission) return false
  const origem = solicitation.payload && typeof solicitation.payload === 'object' ? (solicitation.payload as { origem?: Record<string, unknown> }).origem : null
  if (origem?.rhSolicitationId || origem?.rhProtocolo) return true
  return Boolean(solicitation.parentId && solicitation.parent && isSolicitacaoPessoalSharedFlowRecord(solicitation.parent))
}

export function canUserViewSolicitationByDepartment(
  input: LegacyReceivedInput,
  solicitation: {
    tipoId?: string | null
    status?: string | null
    solicitanteId?: string | null
    approverId?: string | null
    assumidaPorId?: string | null
    departmentId?: string | null
    costCenterId?: string | null
    parentId?: string | null
    payload?: unknown
    parent?: { tipoId?: string | null; tipo?: { codigo?: string | null; nome?: string | null } | null } | null
    tipo?: { codigo?: string | null; nome?: string | null } | null
    solicitacaoSetores?: { setor?: string | null }[]
  },
) {
  if (input.role === 'ADMIN') return true
  if (solicitation.solicitanteId === input.userId) return true
  if (solicitation.assumidaPorId === input.userId) return true
  if (solicitation.approverId === input.userId) return true
  if (input.isRhAuthorizedForSharedHiringFlow && (isSolicitacaoPessoalSharedFlowRecord(solicitation) || isLinkedAdmissionFromSharedHiringFlow(solicitation))) return true
  if (solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID) {
    if (
      EXPERIENCE_EVALUATION_VISIBLE_STATUSES.includes(solicitation.status as never) &&
      (input.isRhAuthorizedForExperienceEvaluation || input.isExperienceEvaluationCoordinator || input.viewerTipoIds?.includes(EXPERIENCE_EVALUATION_TIPO_ID))
    ) return true
    return buildExperienceEvaluatorPayloadFilters(input).some((filter) => JSON.stringify(filter).includes(String(input.userId)))
  }
  if (solicitation.departmentId && input.userDepartmentIds?.includes(solicitation.departmentId)) return true
  if (solicitation.costCenterId && input.userCostCenterIds?.includes(solicitation.costCenterId)) return true
  const setores = new Set((solicitation.solicitacaoSetores ?? []).map((setor) => setor.setor).filter((setor): setor is string => Boolean(setor)))
  if (input.userSetorKeys?.some((setor) => setores.has(setor))) return true
  return Boolean(solicitation.tipoId && input.viewerTipoIds?.includes(solicitation.tipoId))
}
