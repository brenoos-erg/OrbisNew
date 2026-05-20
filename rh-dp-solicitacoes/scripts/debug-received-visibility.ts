import { prisma } from '@/lib/prisma'
import {
  buildReceivedWhereByPolicy,
  canApproveSolicitation,
  canAssumeSolicitation,
  canFinalizeSolicitation,
  canViewSolicitation,
  resolveUserAccessContext,
} from '@/lib/solicitationAccessPolicy'

function parseArg(flag: string) {
  const args = process.argv.slice(2)
  const idx = args.indexOf(flag)
  if (idx === -1) return null
  return args[idx + 1] ?? null
}

async function main() {
  const userArg = parseArg('--user')
  const protocolArg = parseArg('--protocol')

  if (!userArg || !protocolArg) {
    throw new Error('Uso: --user <login|email> --protocol <RQ...>')
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ login: userArg }, { email: userArg }] },
    include: { department: true },
  })

  if (!user) throw new Error(`Usuário não encontrado para ${userArg}`)

  const solicitation = await prisma.solicitation.findFirst({
    where: { protocolo: protocolArg },
    include: {
      department: true,
      costCenter: true,
      solicitacaoSetores: true,
      tipo: { select: { id: true, codigo: true, nome: true } },
    },
  })

  if (!solicitation) throw new Error(`Solicitação não encontrada para ${protocolArg}`)

  const access = await resolveUserAccessContext({
    userId: user.id,
    userLogin: user.login,
    userEmail: user.email,
    userFullName: user.fullName,
    role: user.role,
    primaryDepartmentId: user.departmentId,
    primaryDepartment: user.department,
  })

  const where = buildReceivedWhereByPolicy(access)
  const appears = await prisma.solicitation.findFirst({
    where: { AND: [{ id: solicitation.id }, where] },
    select: { id: true, protocolo: true },
  })

  const canView = canViewSolicitation(access, solicitation)
  const canAssume = canAssumeSolicitation(access, solicitation)
  const canApprove = canApproveSolicitation(access, solicitation)
  const canFinalize = canFinalizeSolicitation(access, solicitation)

  const likelyReasons: string[] = []
  if (!canView) likelyReasons.push('canViewSolicitation=false')
  if (!appears) likelyReasons.push('findFirst(AND[id, buildReceivedWhereByPolicy]) retornou null')
  if (!access.hasSolicitationsModuleAccess) likelyReasons.push('usuário sem acesso ao módulo Solicitações')
  if (solicitation.tipoId === 'RQ_RH_103' && !access.allowedTipoIds.includes('RQ_RH_103')) likelyReasons.push('usuário sem vínculo de tipo/aprovador para RQ_RH_103')

  console.log(
    JSON.stringify(
      {
        user: {
          id: user.id,
          login: user.login,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
          departmentName: user.department?.name,
          costCenterId: user.costCenterId,
        },
        scope: {
          userDepartmentIds: access.userDepartmentIds,
          userCostCenterIds: access.userCostCenterIds,
          userSetorKeys: access.userSetorKeys,
          userDepartmentNamesNormalized: access.userDepartmentNamesNormalized,
          userSectorNamesNormalized: access.userSectorNamesNormalized,
          allowedTipoIds: access.allowedTipoIds,
          viewerTipoIds: access.viewerTipoIds,
          actionableTipoIds: access.actionableTipoIds,
          finalizerTipoIds: access.finalizerTipoIds,
          isExperienceEvaluationCoordinator: access.isExperienceEvaluationCoordinator,
          isRhAuthorizedForExperienceEvaluation: access.isRhAuthorizedForExperienceEvaluation,
          hasSolicitationsModuleAccess: access.hasSolicitationsModuleAccess,
        },
        solicitation: {
          id: solicitation.id,
          protocolo: solicitation.protocolo,
          tipoId: solicitation.tipoId,
          tipoCodigo: solicitation.tipo?.codigo,
          tipoNome: solicitation.tipo?.nome,
          status: solicitation.status,
          departmentId: solicitation.departmentId,
          departmentName: solicitation.department?.name,
          costCenterId: solicitation.costCenterId,
          costCenterName: solicitation.costCenter?.description,
          approverId: solicitation.approverId,
          assumidaPorId: solicitation.assumidaPorId,
          solicitanteId: solicitation.solicitanteId,
          solicitacaoSetores: solicitation.solicitacaoSetores,
          payload: solicitation.payload,
        },
        policyResults: {
          canViewSolicitation: canView,
          canAssumeSolicitation: canAssume,
          canApproveSolicitation: canApprove,
          canFinalizeSolicitation: canFinalize,
          appearsInReceivedByPolicy: Boolean(appears),
        },
        buildReceivedWhereByPolicy: where,
        likelyReason: likelyReasons.length > 0 ? likelyReasons.join('; ') : 'Sem divergência detectada no backend para este usuário/chamado.',
      },
      null,
      2,
    ),
  )
}

main().finally(() => prisma.$disconnect())
