import { Prisma, Role } from '@prisma/client'
import { resolveNadaConstaSetoresByDepartment } from '@/lib/solicitationTypes'
import {
  EXPERIENCE_EVALUATION_STATUS,
  EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
} from '@/lib/experienceEvaluation'

type DepartmentLike = { id?: string | null; code?: string | null; name?: string | null }

type SolicitationVisibilityInput = {
  userId: string
  userLogin?: string | null
  userEmail?: string | null
  userFullName?: string | null
  role: Role
  userDepartmentIds: string[]
  userSetorKeys: string[]
  finalizerTipoIds: string[]
  allowedTipoIds: string[]
}

type SolicitationLike = {
  tipoId?: string | null
  status?: string | null
  solicitanteId: string
  approverId?: string | null
  assumidaPorId?: string | null
  departmentId?: string | null
  solicitacaoSetores?: { setor?: string | null }[]
}

export function resolveUserSetorKeysFromDepartments(departments: DepartmentLike[]) {
  const setorKeys = new Set<string>()

  for (const department of departments) {
    for (const setor of resolveNadaConstaSetoresByDepartment(department)) {
      setorKeys.add(setor)
    }
  }

  return [...setorKeys]
}

export function buildReceivedSolicitationVisibilityWhere(
  input: SolicitationVisibilityInput,
): Prisma.SolicitationWhereInput {
  if (input.role === 'ADMIN') {
    return {}
  }

  const regularSolicitationOrFilters: Prisma.SolicitationWhereInput[] = [
    { assumidaPorId: input.userId },
    { solicitanteId: input.userId },
  ]

  if (input.userDepartmentIds.length > 0) {
    regularSolicitationOrFilters.push({
      departmentId: {
        in: input.userDepartmentIds,
      },
    })
  }

  if (input.userSetorKeys.length > 0) {
    regularSolicitationOrFilters.push({
      solicitacaoSetores: {
        some: {
          setor: {
            in: input.userSetorKeys,
          },
        },
      },
    })
  }

  if (input.allowedTipoIds.length > 0) {
    regularSolicitationOrFilters.push({
      tipoId: {
        in: input.allowedTipoIds,
      },
    })
  }

  const evaluatorPayloadFilters = buildExperienceEvaluatorPayloadFilters(input)

  const orFilters: Prisma.SolicitationWhereInput[] = [
    {
      tipoId: { not: EXPERIENCE_EVALUATION_TIPO_ID },
      OR: regularSolicitationOrFilters,
    },
    {
      tipoId: EXPERIENCE_EVALUATION_TIPO_ID,
      status: EXPERIENCE_EVALUATION_STATUS,
      OR: [
        { solicitanteId: input.userId },
        { approverId: input.userId },
        {
          AND: [
            { OR: [{ approverId: null }, { approverId: '' }] },
            ...(evaluatorPayloadFilters.length > 0 ? [{ OR: evaluatorPayloadFilters }] : []),
          ],
        },
      ],
    },
  ]

  if (input.finalizerTipoIds.length > 0) {
    if (input.finalizerTipoIds.includes(EXPERIENCE_EVALUATION_TIPO_ID)) {
      orFilters.push({
        tipoId: EXPERIENCE_EVALUATION_TIPO_ID,
        status: EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
      })
    }
  }
  return {
    OR: orFilters,
  }
}

function buildExperienceEvaluatorPayloadFilters(
  input: Pick<SolicitationVisibilityInput, 'userId' | 'userLogin' | 'userEmail' | 'userFullName'>,
) {

  const userLogin = input.userLogin?.trim()
  const userEmail = input.userEmail?.trim()
  const userFullName = input.userFullName?.trim()

  const idPaths = [
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
  ]

  const filters: Prisma.SolicitationWhereInput[] = idPaths.map((path) => ({
    payload: { path, equals: input.userId },
  }))

  if (userLogin) {
    for (const path of [
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
    ]) {
      filters.push({ payload: { path, equals: userLogin } })
    }
  }

  if (userEmail) {
    for (const path of [
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
    ]) {
      filters.push({ payload: { path, equals: userEmail } })
    }
  }

  if (userFullName) {
    for (const path of [
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
    ]) {
      filters.push({ payload: { path, equals: userFullName } })
    }
  }

  return filters
}

export function canUserViewSolicitationByDepartment(
  input: SolicitationVisibilityInput,
  solicitation: SolicitationLike,
) {
  if (input.role === 'ADMIN') return true
  if (solicitation.solicitanteId === input.userId) return true
  if (solicitation.assumidaPorId === input.userId) return true
  if (
    solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID &&
    solicitation.status === EXPERIENCE_EVALUATION_FINALIZATION_STATUS &&
    input.finalizerTipoIds.includes(EXPERIENCE_EVALUATION_TIPO_ID)
  ) {
    return true
  }
  if (solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID) {
    return false
  }

  if (isUserInResponsibleDepartment(input.userDepartmentIds, solicitation.departmentId)) {
    return true
  }

  const solicitationSetores = new Set(
    (solicitation.solicitacaoSetores ?? [])
      .map((setor) => setor.setor)
      .filter((setor): setor is string => Boolean(setor)),
  )

  if (solicitationSetores.size > 0) {
    for (const userSetor of input.userSetorKeys) {
      if (solicitationSetores.has(userSetor)) return true
    }
  }

  if (solicitation.tipoId && input.allowedTipoIds.includes(solicitation.tipoId)) {
    return true
  }

  return false
}

export function isUserInResponsibleDepartment(
  userDepartmentIds: string[],
  solicitationDepartmentId?: string | null,
) {
  if (!solicitationDepartmentId) return false
  return userDepartmentIds.includes(solicitationDepartmentId)
}
