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
      { codigo: { in: ['RQ.RH.001', 'RQ.RH.002'] } },
      { nome: { contains: 'Solicitação de pessoal' } },
      { nome: { contains: 'Solicitação de admissão' } },
    ],
  }
}

export function buildSensitiveHiringVisibilityWhere(input: {
  userId: string
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