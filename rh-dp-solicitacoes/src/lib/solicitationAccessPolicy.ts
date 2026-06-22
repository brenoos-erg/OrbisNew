import { ModuleLevel, Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { resolveNadaConstaSetoresByDepartment } from './solicitationTypes'
import type { SolicitationVisibilityUserContext } from './solicitationVisibility'

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

  const isAdminTechnical =
    record?.role === 'ADMIN' ||
    user.role === 'ADMIN' ||
    hasMinLevel(solicitationModuleLevel, ModuleLevel.NIVEL_3) ||
    hasMinLevel(configuracoesModuleLevel, ModuleLevel.NIVEL_3)

  return {
    userId: user.id,
    role: record?.role ?? user.role ?? null,
    departmentIds: [...departmentIds],
    costCenterIds: [...costCenterIds],
    nadaConstaSetores: [...nadaConstaSetores],
    sharedRhDpDepartmentIds: [...sharedRhDpDepartmentIds],
    sharedRhDpCostCenterIds: [...sharedRhDpCostCenterIds],
    solicitationModuleLevel,
    configuracoesModuleLevel,
    isAdminTechnical,
  }
}

export function buildReceivedWhereByPolicy(
  ctx: SolicitationVisibilityUserContext,
  baseWhere: Prisma.SolicitationWhereInput = {},
  options: { excludePendingRq063?: boolean } = {},
): Prisma.SolicitationWhereInput {
  const receivedFilters: Prisma.SolicitationWhereInput[] = []

  receivedFilters.push({ assumidaPorId: ctx.userId })
  receivedFilters.push({ approverId: ctx.userId })

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
