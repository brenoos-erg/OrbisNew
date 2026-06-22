process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'node',
})

const { PrismaClient, ModuleLevel } = require('@prisma/client')
const {
  canUserViewSolicitationByFallback,
} = require('../src/lib/solicitationVisibility.ts')
const {
  resolveNadaConstaSetoresByDepartment,
} = require('../src/lib/solicitationTypes.ts')

type Args = {
  protocolo?: string
  user?: string
  userId?: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = argv[index + 1]
    if (current === '--protocolo' && next) {
      args.protocolo = next
      index += 1
    } else if (current === '--user' && next) {
      args.user = next
      index += 1
    } else if (current === '--userId' && next) {
      args.userId = next
      index += 1
    }
  }
  return args
}

function hasMinLevel(level: string | null | undefined, minLevel: string) {
  const order = [ModuleLevel.NIVEL_1, ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3]
  return order.indexOf(level) >= order.indexOf(minLevel)
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

function isRhDpDepartment(department?: { code?: string | null; name?: string | null } | null) {
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

function isRhDpCostCenter(costCenter?: {
  code?: string | null
  externalCode?: string | null
  abbreviation?: string | null
  description?: string | null
  department?: { code?: string | null; name?: string | null } | null
} | null) {
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.protocolo || (!args.user && !args.userId)) {
    throw new Error(
      'Uso: npx ts-node scripts/debug-solicitation-visibility.ts --protocolo RQ2026-01410 --user email@dominio.com',
    )
  }

  const prisma = new PrismaClient()
  try {
    const solicitation = await prisma.solicitation.findUnique({
      where: { protocolo: args.protocolo },
      include: {
        tipo: true,
        department: true,
        costCenter: true,
        solicitante: { select: { id: true, fullName: true, email: true } },
        approver: { select: { id: true, fullName: true, email: true } },
        assumidaPor: { select: { id: true, fullName: true, email: true } },
        solicitacaoSetores: { orderBy: { setor: 'asc' } },
      },
    })

    if (!solicitation) {
      throw new Error(`Protocolo nao encontrado: ${args.protocolo}`)
    }

    const userWhere = args.userId
      ? { id: args.userId }
      : {
          OR: [
            { email: args.user },
            { login: args.user },
            { fullName: { contains: args.user, mode: 'insensitive' } },
          ],
        }

    const user = await prisma.user.findFirst({
      where: userWhere,
      select: {
        id: true,
        fullName: true,
        email: true,
        login: true,
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

    if (!user) {
      throw new Error(`Usuario nao encontrado: ${args.user ?? args.userId}`)
    }

    const departments = [
      ...(user.department ? [user.department] : []),
      ...user.userDepartments.map((link: any) => link.department),
    ]
    const costCenters = [
      ...(user.costCenter ? [user.costCenter] : []),
      ...user.costCenters.map((link: any) => link.costCenter).filter(Boolean),
    ]

    const moduleLevels = Object.fromEntries(
      user.moduleAccesses.map((access: any) => [
        access.module.key,
        access.level,
      ]),
    )

    const departmentIds = departments.map((department: any) => department.id)
    const costCenterIds = costCenters.map((costCenter: any) => costCenter.id)
    const nadaConstaSetores = [
      ...new Set(
        departments.flatMap((department: any) =>
          resolveNadaConstaSetoresByDepartment(department),
        ),
      ),
    ]
    const sharedRhDpDepartmentIds = departments
      .filter(isRhDpDepartment)
      .map((department: any) => department.id)
    const sharedRhDpCostCenterIds = costCenters
      .filter(isRhDpCostCenter)
      .map((costCenter: any) => costCenter.id)

    const ctx = {
      userId: user.id,
      role: user.role,
      departmentIds,
      costCenterIds,
      nadaConstaSetores,
      sharedRhDpDepartmentIds,
      sharedRhDpCostCenterIds,
      solicitationModuleLevel: moduleLevels.solicitacoes,
      configuracoesModuleLevel: moduleLevels.configuracoes,
      isAdminTechnical:
        user.role === 'ADMIN' ||
        hasMinLevel(moduleLevels.solicitacoes, ModuleLevel.NIVEL_3) ||
        hasMinLevel(moduleLevels.configuracoes, ModuleLevel.NIVEL_3),
    }

    const result = canUserViewSolicitationByFallback(ctx, solicitation)

    console.dir(
      {
        protocolo: solicitation.protocolo,
        canView: result.canView,
        reasons: result.reasons,
        solicitation: {
          id: solicitation.id,
          tipoId: solicitation.tipoId,
          tipo: solicitation.tipo?.nome,
          status: solicitation.status,
          departmentId: solicitation.departmentId,
          department: solicitation.department,
          costCenterId: solicitation.costCenterId,
          costCenter: solicitation.costCenter,
          solicitante: solicitation.solicitante,
          approverId: solicitation.approverId,
          approver: solicitation.approver,
          assumidaPorId: solicitation.assumidaPorId,
          assumidaPor: solicitation.assumidaPor,
          snapshots: {
            workflowSnapshotJson: Object.prototype.hasOwnProperty.call(
              solicitation,
              'workflowSnapshotJson',
            )
              ? (solicitation as any).workflowSnapshotJson != null
              : 'campo ausente no schema atual',
            approvalSnapshotJson: Object.prototype.hasOwnProperty.call(
              solicitation,
              'approvalSnapshotJson',
            )
              ? (solicitation as any).approvalSnapshotJson != null
              : 'campo ausente no schema atual',
            notificationSnapshotJson: Object.prototype.hasOwnProperty.call(
              solicitation,
              'notificationSnapshotJson',
            )
              ? (solicitation as any).notificationSnapshotJson != null
              : 'campo ausente no schema atual',
          },
          solicitacaoSetores: solicitation.solicitacaoSetores,
        },
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          login: user.login,
          role: user.role,
          departmentIds,
          departments,
          costCenterIds,
          costCenters,
          nadaConstaSetores,
          sharedRhDpDepartmentIds,
          sharedRhDpCostCenterIds,
          moduleLevels,
        },
      },
      { depth: null },
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
