import { Prisma, Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isSolicitacaoAdmissao, isSolicitacaoPessoal } from '@/lib/solicitationTypes'

type TipoLike = {
  id?: string | null
  codigo?: string | null
  nome?: string | null
}

export function isSensitiveHiringRequest(tipo?: TipoLike | null) {
  if (!tipo) return false
  return isSolicitacaoPessoal(tipo) || isSolicitacaoAdmissao(tipo)
}

export function buildSensitiveHiringTipoWhere(): Prisma.TipoSolicitacaoWhereInput {
  return {
    OR: [
      { id: { in: ['RQ_063', 'SOLICITACAO_ADMISSAO'] } },
      { codigo: { in: ['RQ.RH.063', 'RQ.063', 'RQ.RH.001', 'RQ.RH.103'] } },
      { nome: { contains: 'Solicitação de pessoal' } },
      { nome: { contains: 'Solicitação de admissão' } },
    ],
  }
}

export function buildSensitiveHiringVisibilityWhere(input: {
  userId: string
  userLogin?: string | null
  userEmail?: string | null
  userFullName?: string | null
  role?: Role | null
  departmentIds?: string[]
}) {
  const isAdmin = input.role === 'ADMIN'
  const isRh = input.role === 'RH'
  const relatedDepartments = (input.departmentIds ?? []).filter(Boolean)

  const participantFilters: Prisma.SolicitationWhereInput[] = [
    { solicitanteId: input.userId },
    { assumidaPorId: input.userId },
    { approverId: input.userId },
  ]

  if (relatedDepartments.length > 0) {
    participantFilters.push({ departmentId: { in: relatedDepartments } })
  }

  if (isAdmin || isRh) {
    participantFilters.push({ id: { not: '' } })
  }

  const normalizedLogin = normalizeParticipantValue(input.userLogin)
  const normalizedEmail = normalizeParticipantValue(input.userEmail)
  const normalizedFullName = normalizeParticipantValue(input.userFullName)

  for (const path of EXPERIENCE_EVALUATOR_ID_PATHS) {
    participantFilters.push({
      AND: [{ tipoId: 'RQ_RH_103' }, { payload: { path, equals: input.userId } }],
    })
  }
  if (normalizedLogin) {
    for (const path of EXPERIENCE_EVALUATOR_LOGIN_PATHS) {
      participantFilters.push({
        AND: [{ tipoId: 'RQ_RH_103' }, { payload: { path, equals: normalizedLogin } }],
      })
    }
  }
  if (normalizedEmail) {
    for (const path of EXPERIENCE_EVALUATOR_EMAIL_PATHS) {
      participantFilters.push({
        AND: [{ tipoId: 'RQ_RH_103' }, { payload: { path, equals: normalizedEmail } }],
      })
    }
  }
  if (normalizedFullName) {
    for (const path of EXPERIENCE_EVALUATOR_NAME_PATHS) {
      participantFilters.push({
        AND: [{ tipoId: 'RQ_RH_103' }, { payload: { path, equals: normalizedFullName } }],
      })
    }
  }

  return {
    OR: [
      { tipo: { NOT: buildSensitiveHiringTipoWhere() } },
      {
        AND: [
          { tipo: buildSensitiveHiringTipoWhere() },
          { OR: participantFilters },
        ],
      },
    ],
  } satisfies Prisma.SolicitationWhereInput
}

const EXPERIENCE_EVALUATOR_ID_PATHS = [
  '$.campos.gestorImediatoAvaliadorId',
  '$.metadata.gestorImediatoAvaliadorId',
  '$.requestData.gestorImediatoAvaliadorId',
  '$.dynamicForm.gestorImediatoAvaliadorId',
  '$.campos.avaliadorId',
  '$.metadata.avaliadorId',
  '$.requestData.avaliadorId',
  '$.dynamicForm.avaliadorId',
  '$.campos.gestorId',
  '$.metadata.gestorId',
  '$.requestData.gestorId',
  '$.dynamicForm.gestorId',
] as const

const EXPERIENCE_EVALUATOR_LOGIN_PATHS = [
  '$.campos.gestorImediatoAvaliadorLogin',
  '$.metadata.gestorImediatoAvaliadorLogin',
  '$.requestData.gestorImediatoAvaliadorLogin',
  '$.dynamicForm.gestorImediatoAvaliadorLogin',
  '$.campos.avaliadorLogin',
  '$.metadata.avaliadorLogin',
  '$.requestData.avaliadorLogin',
  '$.dynamicForm.avaliadorLogin',
  '$.campos.gestorLogin',
  '$.metadata.gestorLogin',
  '$.requestData.gestorLogin',
  '$.dynamicForm.gestorLogin',
] as const

const EXPERIENCE_EVALUATOR_EMAIL_PATHS = [
  '$.campos.gestorImediatoAvaliadorEmail',
  '$.metadata.gestorImediatoAvaliadorEmail',
  '$.requestData.gestorImediatoAvaliadorEmail',
  '$.dynamicForm.gestorImediatoAvaliadorEmail',
  '$.campos.avaliadorEmail',
  '$.metadata.avaliadorEmail',
  '$.requestData.avaliadorEmail',
  '$.dynamicForm.avaliadorEmail',
  '$.campos.gestorEmail',
  '$.metadata.gestorEmail',
  '$.requestData.gestorEmail',
  '$.dynamicForm.gestorEmail',
] as const

const EXPERIENCE_EVALUATOR_NAME_PATHS = [
  '$.campos.gestorImediatoAvaliador',
  '$.metadata.gestorImediatoAvaliador',
  '$.requestData.gestorImediatoAvaliador',
  '$.dynamicForm.gestorImediatoAvaliador',
  '$.campos.avaliador',
  '$.metadata.avaliador',
  '$.requestData.avaliador',
  '$.dynamicForm.avaliador',
  '$.campos.gestor',
  '$.metadata.gestor',
  '$.requestData.gestor',
  '$.dynamicForm.gestor',
] as const

function normalizeParticipantValue(value?: string | null) {
  return String(value ?? '').trim() || null
}

export function canViewSensitiveHiringRequest(input: {
  user: { id: string; role?: Role | null }
  solicitation: {
    solicitanteId?: string | null
    assumidaPorId?: string | null
    approverId?: string | null
    departmentId?: string | null
    tipo?: TipoLike | null
  }
  isAdmin?: boolean
  isRequester?: boolean
  isAssigned?: boolean
  isResponsibleDepartmentMember?: boolean
  isExplicitRecipient?: boolean
  isRh?: boolean
}) {
  if (!isSensitiveHiringRequest(input.solicitation.tipo)) return true

  const isAdmin = input.isAdmin ?? input.user.role === 'ADMIN'
  const isRequester = input.isRequester ?? input.solicitation.solicitanteId === input.user.id
  const isAssigned =
    input.isAssigned ??
    (input.solicitation.assumidaPorId === input.user.id ||
      input.solicitation.approverId === input.user.id)
  const isResponsibleDepartmentMember = input.isResponsibleDepartmentMember ?? false
  const isExplicitRecipient = input.isExplicitRecipient ?? input.solicitation.approverId === input.user.id
  const isRh = input.isRh ?? input.user.role === 'RH'

  return isAdmin || isRequester || isAssigned || isResponsibleDepartmentMember || isExplicitRecipient || isRh
}

export async function getUserDepartmentIds(userId: string, primaryDepartmentId?: string | null) {
  const links = await prisma.userDepartment.findMany({
    where: { userId },
    select: { departmentId: true },
  })

  return Array.from(
    new Set([primaryDepartmentId, ...links.map((link) => link.departmentId)].filter((v): v is string => Boolean(v))),
  )
}
