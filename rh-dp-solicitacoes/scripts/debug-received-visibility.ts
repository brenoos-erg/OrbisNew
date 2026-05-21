import { prisma } from '@/lib/prisma'
import { resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'
import { isNadaConstaSolicitation, normalizeSectorKey, userCanSeeNadaConstaBySector } from '@/lib/solicitationVisibility'

function parseArg(flag: string) {
  const args = process.argv.slice(2)
  const idx = args.indexOf(flag)
  if (idx === -1) return null
  return args[idx + 1] ?? null
}

async function main() {
  const userArg = parseArg('--user')
  const emailArg = parseArg('--email')
  const protocolArg = parseArg('--protocol')
  const identity = userArg ?? emailArg
  if (!identity) throw new Error('Uso: --user <login> ou --email <email> [--protocol RQ2026-XXXXX]')

  const user = await prisma.user.findFirst({
    where: { OR: [{ login: identity }, { email: identity }] },
    include: { department: true, costCenter: true, costCenters: { include: { costCenter: true } }, userDepartments: { include: { department: true } } },
  })
  if (!user) throw new Error(`Usuário não encontrado: ${identity}`)

  const access = await resolveUserAccessContext({
    userId: user.id, userLogin: user.login, userEmail: user.email, userFullName: user.fullName,
    role: user.role, primaryDepartmentId: user.departmentId, primaryDepartment: user.department,
  })

  const whereProtocol = protocolArg ? { protocolo: protocolArg } : {}
  const solicitations = await prisma.solicitation.findMany({
    where: whereProtocol,
    take: protocolArg ? 1 : 5,
    orderBy: { dataAbertura: 'desc' },
    include: { department: true, costCenter: true, solicitacaoSetores: true, tipo: { select: { id: true, codigo: true, nome: true } } },
  })

  const userSectorKeys = new Set([
    ...access.userDepartmentNamesNormalized.map(normalizeSectorKey),
    ...access.userSectorNamesNormalized.map(normalizeSectorKey),
  ])

  const results = solicitations.map((s) => ({
    protocolo: s.protocolo,
    tipo: s.tipo,
    isNadaConsta: isNadaConstaSolicitation(s),
    setoresEncontrados: Array.from(new Set((JSON.stringify(s.payload ?? '') + ' ' + JSON.stringify(s.solicitacaoSetores ?? '')).split(/[^\p{L}0-9]+/u).map(normalizeSectorKey).filter(Boolean))),
    matchBySectorRule: userCanSeeNadaConstaBySector(access, s as unknown as Record<string, unknown>),
    shouldAppearInReceived: userCanSeeNadaConstaBySector(access, s as unknown as Record<string, unknown>) || !isNadaConstaSolicitation(s),
  }))

  console.log(JSON.stringify({
    user: { id: user.id, nome: user.fullName, login: user.login, email: user.email },
    departamentosVinculados: user.userDepartments.map((d) => ({ id: d.departmentId, nome: d.department?.name })),
    centrosCustoVinculados: user.costCenters.map((c) => ({ id: c.costCenterId, nome: c.costCenter?.description })),
    scope: {
      userDepartmentIds: access.userDepartmentIds,
      userDepartmentNamesNormalized: access.userDepartmentNamesNormalized,
      userCostCenterIds: access.userCostCenterIds,
      userSectorNamesNormalized: access.userSectorNamesNormalized,
      userSectorKeysNormalized: Array.from(userSectorKeys),
    },
    solicitacoesAnalisadas: results,
  }, null, 2))
}

main().finally(() => prisma.$disconnect())
