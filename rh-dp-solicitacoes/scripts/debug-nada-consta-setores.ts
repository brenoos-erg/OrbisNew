import { PrismaClient } from '@prisma/client'
import { buildReceivedSolicitationVisibilityWhere } from '@/lib/solicitationVisibility'
import { resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'
import { applyReceivedSectorVisibilityFilter } from '@/lib/receivedSolicitationsQuery'
import { NADA_CONSTA_SETORES } from '@/lib/solicitationTypes'

const prisma = new PrismaClient()
const REQUIRED = NADA_CONSTA_SETORES.map((item) => item.key)

async function main() {
  const userId = process.argv[2]
  if (!userId) throw new Error('Uso: ts-node scripts/debug-nada-consta-setores.ts <userId>')

  const me = await prisma.user.findUnique({ where: { id: userId }, include: { department: true } })
  if (!me) throw new Error('Usuário não encontrado')

  const access = await resolveUserAccessContext({
    userId: me.id, userLogin: me.login, userEmail: me.email, userFullName: me.fullName, role: me.role, primaryDepartmentId: me.departmentId, primaryDepartment: me.department,
  })

  const baseWhere = buildReceivedSolicitationVisibilityWhere({
    userId: me.id, userLogin: me.login, userEmail: me.email, userFullName: me.fullName, role: me.role, userDepartmentIds: access.userDepartmentIds, userCostCenterIds: access.userCostCenterIds, userDepartmentNamesNormalized: access.userDepartmentNamesNormalized, userSectorNamesNormalized: access.userSectorNamesNormalized, allowedTipoIds: access.allowedTipoIds, finalizerTipoIds: access.finalizerTipoIds, viewerTipoIds: access.viewerTipoIds, userSetorKeys: access.userSetorKeys,
    isExperienceEvaluationCoordinator: access.isExperienceEvaluationCoordinator, isRhAuthorizedForExperienceEvaluation: access.isRhAuthorizedForExperienceEvaluation,
  })

  const nadaConsta = await prisma.solicitation.findMany({ where: { tipo: { codigo: { in: ['RQ.RH.001', 'RQ.001'] } } }, select: { protocolo: true, solicitacaoSetores: { select: { setor: true, status: true } } } })
  const visiveisPolitica = await prisma.solicitation.findMany({ where: { AND: [baseWhere, { tipo: { codigo: { in: ['RQ.RH.001', 'RQ.001'] } } }] }, select: { protocolo: true, tipoId: true, departmentId: true, costCenterId: true, solicitacaoSetores: { select: { setor: true, status: true, constaFlag: true } } } })

  const posFiltro = applyReceivedSectorVisibilityFilter(visiveisPolitica as any, { normalizedSectorNames: access.userSectorNamesNormalized, departmentIds: access.userDepartmentIds, costCenterIds: access.userCostCenterIds, viewerTipoIds: access.viewerTipoIds, userSetorKeys: access.userSetorKeys, userId: me.id, finalizerTipoIds: access.finalizerTipoIds, isExperienceEvaluationCoordinator: access.isExperienceEvaluationCoordinator, isRhAuthorizedForExperienceEvaluation: access.isRhAuthorizedForExperienceEvaluation })
  const protocolosPos = new Set(posFiltro.map((r: any) => r.protocolo))
  const removidos = visiveisPolitica.filter((r) => !protocolosPos.has(r.protocolo))

  const missingBySetor = Object.fromEntries(REQUIRED.map((setor) => [setor, [] as string[]]))
  const missingAny: string[] = []
  for (const row of nadaConsta) {
    const existing = new Set(row.solicitacaoSetores.map((s) => s.setor))
    let miss = false
    for (const setor of REQUIRED) {
      if (!existing.has(setor)) { (missingBySetor[setor] as string[]).push(row.protocolo ?? 'sem-protocolo'); miss = true }
    }
    if (miss) missingAny.push(row.protocolo ?? 'sem-protocolo')
  }

  console.log(JSON.stringify({
    usuario: { id: me.id, nome: me.fullName, departamentos: access.userDepartmentIds, userSetorKeys: access.userSetorKeys },
    totalNadaConsta: nadaConsta.length,
    totalVisiveisPolitica: visiveisPolitica.length,
    totalPosFiltro: posFiltro.length,
    totalRemovidoPosFiltro: removidos.length,
    protocolosRemovidos: removidos.map((r) => r.protocolo),
    missingBySetor,
    missingAny,
    setoresPorProtocolo: nadaConsta.map((n) => ({ protocolo: n.protocolo, setores: n.solicitacaoSetores.map((s) => s.setor).sort() })),
  }, null, 2))
}

main().finally(async () => prisma.$disconnect())
