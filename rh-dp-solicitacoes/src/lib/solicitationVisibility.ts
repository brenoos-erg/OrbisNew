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

  const orFilters: Prisma.SolicitationWhereInput[] = [
    { approverId: input.userId },
    { assumidaPorId: input.userId },
  ]

  if (input.userDepartmentIds.length > 0) {
    orFilters.push({
      departmentId: {
        in: input.userDepartmentIds,
      },
    })
  }

  if (input.userSetorKeys.length > 0) {
    orFilters.push({
      solicitacaoSetores: {
        some: {
          setor: {
            in: input.userSetorKeys,
          },
        },
      },
    })
  }

   if (input.finalizerTipoIds.length > 0) {
    orFilters.push({
      tipoId: {
        in: input.finalizerTipoIds,
      },
      status: EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
    })
  }

  const userLogin = input.userLogin?.trim()
  const userEmail = input.userEmail?.trim()
  const userFullName = input.userFullName?.trim()
  const evaluatorPayloadFilters: Prisma.SolicitationWhereInput[] = [
    {
      payload: {
        path: '$.campos.gestorImediatoAvaliadorId',
        equals: input.userId,
      },
    },
  ]

  if (userLogin) {
    evaluatorPayloadFilters.push({
      payload: {
        path: '$.campos.gestorImediatoAvaliadorLogin',
        equals: userLogin,
      },
    })
  }

  if (userEmail) {
    evaluatorPayloadFilters.push({
      payload: {
        path: '$.campos.gestorImediatoAvaliadorEmail',
        equals: userEmail,
      },
    })
  }

  if (userFullName) {
    evaluatorPayloadFilters.push({
      payload: {
        path: '$.campos.gestorImediatoAvaliador',
        equals: userFullName,
      },
    })
  }

  orFilters.push({
    tipoId: EXPERIENCE_EVALUATION_TIPO_ID,
    status: EXPERIENCE_EVALUATION_STATUS,
    OR: [
      { approverId: input.userId },
      ...evaluatorPayloadFilters,
    ],
  })
  return {
    OR: orFilters,
  }
}

export function canUserViewSolicitationByDepartment(
  input: SolicitationVisibilityInput,
  solicitation: SolicitationLike,
) {
  if (input.role === 'ADMIN') return true
  if (solicitation.solicitanteId === input.userId) return true
  if (solicitation.approverId === input.userId) return true
  if (solicitation.assumidaPorId === input.userId) return true
  if (
    solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID &&
    solicitation.status === EXPERIENCE_EVALUATION_FINALIZATION_STATUS &&
    input.finalizerTipoIds.includes(EXPERIENCE_EVALUATION_TIPO_ID)
  ) {
    return true
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

  return false
}

export function isUserInResponsibleDepartment(
  userDepartmentIds: string[],
  solicitationDepartmentId?: string | null,
) {
  if (!solicitationDepartmentId) return false
  return userDepartmentIds.includes(solicitationDepartmentId)
}