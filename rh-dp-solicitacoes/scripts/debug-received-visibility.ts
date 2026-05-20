import { prisma } from '@/lib/prisma'
import { resolveUserAccessContext, buildReceivedWhereByPolicy } from '@/lib/solicitationAccessPolicy'

async function main() {
  const args = process.argv.slice(2)
  const userArg = args[args.indexOf('--user') + 1]
  const protocolArg = args[args.indexOf('--protocol') + 1]
  if (!userArg || !protocolArg) throw new Error('Uso: --user <login|email> --protocol <RQ...>')

  const user = await prisma.user.findFirst({ where: { OR: [{ login: userArg }, { email: userArg }] }, include: { department: true } })
  if (!user) throw new Error('Usuário não encontrado')
  const solicitation = await prisma.solicitation.findFirst({ where: { protocolo: protocolArg }, include: { department: true, costCenter: true, solicitacaoSetores: true } })
  if (!solicitation) throw new Error('Solicitação não encontrada')

  const access = await resolveUserAccessContext({ userId: user.id, userLogin: user.login, userEmail: user.email, userFullName: user.fullName, role: user.role, primaryDepartmentId: user.departmentId, primaryDepartment: user.department })
  const where = buildReceivedWhereByPolicy(access)
  const appears = await prisma.solicitation.findFirst({ where: { AND: [{ id: solicitation.id }, where] }, select: { id: true, protocolo: true } })

  console.log(JSON.stringify({
    user: { id: user.id, login: user.login, email: user.email, departmentId: user.departmentId, costCenterId: user.costCenterId },
    scope: {
      userDepartmentIds: access.userDepartmentIds,
      userCostCenterIds: access.userCostCenterIds,
      userSectorNamesNormalized: access.userSectorNamesNormalized,
      allowedTipoIds: access.allowedTipoIds,
      viewerTipoIds: access.viewerTipoIds,
    },
    solicitation: {
      id: solicitation.id,
      protocolo: solicitation.protocolo,
      departmentId: solicitation.departmentId,
      departmentName: solicitation.department?.name,
      costCenterId: solicitation.costCenterId,
      costCenterName: solicitation.costCenter?.description,
      solicitacaoSetores: solicitation.solicitacaoSetores,
      status: solicitation.status,
      tipoId: solicitation.tipoId,
    },
    appearsInReceivedByPolicy: Boolean(appears),
  }, null, 2))
}

main().finally(() => prisma.$disconnect())
