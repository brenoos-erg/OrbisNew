import { prisma } from '@/lib/prisma'
import { isSolicitacaoPessoal } from '@/lib/solicitationTypes'
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
    where: { OR: [{ id: userArg }, { login: userArg }, { email: userArg }] },
    include: { department: true, costCenter: true, costCenters: { include: { costCenter: true } }, userDepartments: { include: { department: true } }, tipoSolicitacaoApprovers: true },
  })

  if (!user) throw new Error(`Usuário não encontrado para ${userArg}`)

  const solicitation = await prisma.solicitation.findFirst({
    where: { protocolo: protocolArg },
    include: {
      department: true,
      costCenter: true,
      solicitante: { select: { id: true, fullName: true, login: true, email: true } },
      approver: { select: { id: true, fullName: true, login: true, email: true } },
      assumidaPor: { select: { id: true, fullName: true, login: true, email: true } },
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
  if (solicitation.requiresApproval && solicitation.approvalStatus === 'PENDENTE' && isSolicitacaoPessoal(solicitation.tipo)) {
    likelyReasons.push('Esta Solicitação de Pessoal ainda está aguardando aprovação e por isso ainda não chegou para RH/DP.')
  }
  if (solicitation.tipoId === 'RQ_RH_103' && !access.allowedTipoIds.includes('RQ_RH_103')) likelyReasons.push('usuário sem vínculo de tipo/aprovador para RQ_RH_103')
  if (access.userDepartmentIds?.includes(solicitation.departmentId ?? '')) likelyReasons.push('usuário vinculado ao departamento atual')
  if (access.userCostCenterIds?.includes(solicitation.costCenterId ?? '')) likelyReasons.push('usuário vinculado ao centro de custo atual')
  if (solicitation.assumidaPorId === user.id) likelyReasons.push('usuário assumiu o chamado')
  if (solicitation.approverId === user.id) likelyReasons.push('usuário é aprovador direto')
  if (solicitation.solicitacaoSetores.some((setor) => access.userSetorKeys?.includes(setor.setor))) likelyReasons.push('usuário vinculado ao setor Nada Consta atual')

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
          costCenterName: user.costCenter?.description,
          departmentLinks: user.userDepartments.map((link) => ({ id: link.departmentId, name: link.department?.name })),
          costCenterLinks: user.costCenters.map((link) => ({ id: link.costCenterId, name: link.costCenter?.description })),
          tipoApprover: user.tipoSolicitacaoApprovers.filter((link) => link.role === 'APPROVER').map((link) => link.tipoId),
          tipoViewer: user.tipoSolicitacaoApprovers.filter((link) => link.role === 'VIEWER').map((link) => link.tipoId),
          tipoFinalizer: user.tipoSolicitacaoApprovers.filter((link) => link.role === 'FINALIZER').map((link) => link.tipoId),
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
          approver: solicitation.approver,
          assumidaPorId: solicitation.assumidaPorId,
          assumidaPor: solicitation.assumidaPor,
          requiresApproval: solicitation.requiresApproval,
          approvalStatus: solicitation.approvalStatus,
          solicitanteId: solicitation.solicitanteId,
          solicitante: solicitation.solicitante,
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
        policyResult: Boolean(appears) ? 'aparece' : 'não aparece',
        objectiveReason: likelyReasons.length > 0 ? likelyReasons.join('; ') : 'Sem divergência detectada no backend para este usuário/chamado.',
      },
      null,
      2,
    ),
  )
}

main().finally(() => prisma.$disconnect())
