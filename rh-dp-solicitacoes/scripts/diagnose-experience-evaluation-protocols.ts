import { PrismaClient } from '@prisma/client'
import { buildReceivedSolicitationVisibilityWhere } from '@/lib/solicitationVisibility'
import {
  EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
  hasExperienceEvaluationPrintableData,
  normalizeExperienceEvaluationPayload,
} from '@/lib/experienceEvaluation'
import { isExperienceEvaluationTipo } from '@/lib/experienceEvaluationForm'
import { resolveExperienceEvaluationAssignedEvaluator } from '@/lib/experienceEvaluation.shared'

const prisma = new PrismaClient()

const DEFAULT_PROTOCOLS = [
  'RQ2026-00203',
  'RQ2026-00210',
  'RQ2026-00657',
  'RQ2026-00763',
  'RQ2026-01234',
  'RQ2026-01395',
]

function readArg(name: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (direct) return direct.split('=').slice(1).join('=')
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : ''
}
// Aceita --protocol RQ2026-02411 ou --protocols RQ1,RQ2.
const protocols = (readArg('protocols') || readArg('protocol') || process.argv.slice(2).filter((arg) => !arg.startsWith('--')).join(',')).split(',').map((item) => item.trim()).filter(Boolean)
const targetProtocols = protocols.length > 0 ? protocols : DEFAULT_PROTOCOLS

function print(label: string, value: unknown) {
  console.log(`  - ${label}: ${value ?? '-'}`)
}

function existingEvaluationFields(payload: unknown) {
  const normalized = normalizeExperienceEvaluationPayload(payload)
  return Object.entries(normalized)
    .filter(([, value]) => value && value !== '-')
    .map(([key]) => key)
}

function probableMissingReason(solicitation: any) {
  if (!solicitation) return 'Solicitação não encontrada.'
  if (!isExperienceEvaluationTipo({ id: solicitation.tipo?.id ?? solicitation.tipoId, codigo: solicitation.tipo?.codigo, nome: solicitation.tipo?.nome })) return 'Não é RQ_RH_103/RQ.RH.103.'
  if (solicitation.status === 'CONCLUIDA' || solicitation.status === 'FINALIZADA') {
    return 'Antes da correção, a visibilidade de RQ_RH_103 considerava apenas etapas pendentes e excluía concluídas/finalizadas.'
  }
  if (!solicitation.approverId && !solicitation.assumidaPorId) {
    return 'Sem responsável atual; a consulta deve depender da relação/permissão, não de responsável obrigatório.'
  }
  return 'Verificar relação do usuário com o chamado e permissões configuradas para RQ_RH_103.'
}

async function main() {
  console.log('Diagnóstico de Avaliação do período de experiência')
  console.log(`Protocolos: ${targetProtocols.join(', ')}`)

  const authorizedWhere = buildReceivedSolicitationVisibilityWhere({
  userId: '__diagnostico_rh__',
  role: 'RH',
  userDepartmentIds: [],
  userCostCenterIds: [],
  userDepartmentNamesNormalized: [],
  userSectorNamesNormalized: [],
  userSetorKeys: [],
  finalizerTipoIds: ['RQ_RH_103'],
  allowedTipoIds: ['RQ_RH_103'],
  viewerTipoIds: ['RQ_RH_103'],
  isExperienceEvaluationCoordinator: true,
  isRhAuthorizedForExperienceEvaluation: true,
})

  for (const protocolo of targetProtocols) {
    console.log(`\n${protocolo}`)
    const solicitation = await prisma.solicitation.findUnique({
      where: { protocolo },
      include: {
        tipo: { select: { id: true, codigo: true, nome: true } },
        solicitante: { select: { id: true, fullName: true, login: true, email: true } },
        department: { select: { id: true, name: true, code: true, sigla: true } },
        approver: { select: { id: true, fullName: true, login: true, email: true } },
        assumidaPor: { select: { id: true, fullName: true, login: true, email: true } },
      },
    })

    print('encontrado', solicitation ? 'sim' : 'não')
    if (!solicitation) continue

    const appearsForAuthorized = await prisma.solicitation.count({
      where: { AND: [{ id: solicitation.id }, authorizedWhere] },
    })
    const normalized = normalizeExperienceEvaluationPayload(solicitation.payload)
    const fields = existingEvaluationFields(solicitation.payload)
    const pdfAllowedByStatus =
      isExperienceEvaluationTipo({ id: solicitation.tipo?.id ?? solicitation.tipoId, codigo: solicitation.tipo?.codigo, nome: solicitation.tipo?.nome }) &&
      solicitation.status !== 'CANCELADA' &&
      [EXPERIENCE_EVALUATION_FINALIZATION_STATUS, 'CONCLUIDA', 'FINALIZADA'].includes(String(solicitation.status))

    print('id', solicitation.id)
    print('tipoId', solicitation.tipoId)
    print('protocolo', solicitation.protocolo)
    print('tipo.codigo', solicitation.tipo?.codigo ?? '-')
    print('tipo.nome', solicitation.tipo?.nome ?? '-')
    print('status', solicitation.status)
    print('approvalStatus', solicitation.approvalStatus)
    print('approverId', solicitation.approverId)
    print('approver.nome/login/email', `${solicitation.approver?.fullName ?? '-'} / ${solicitation.approver?.login ?? '-'} / ${solicitation.approver?.email ?? '-'}`)
    print('assumidaPorId', solicitation.assumidaPorId)
    print('solicitante', `${solicitation.solicitante?.fullName ?? '-'} / ${solicitation.solicitante?.login ?? '-'} / ${solicitation.solicitante?.email ?? '-'}`)
    print('departmentId/departamento atual', `${solicitation.departmentId ?? '-'} / ${solicitation.department?.name ?? '-'}`)
    print('costCenterId/centro atual', solicitation.costCenterId ?? '-')
    print('responsável atual', solicitation.assumidaPor?.fullName ?? '-')
    print('approver', solicitation.approver?.fullName ?? '-')
    print('assumidaPor', solicitation.assumidaPor?.fullName ?? '-')
    print('data abertura', solicitation.dataAbertura?.toISOString())
    print('data fechamento', solicitation.dataFechamento?.toISOString() ?? '-')
    print('aparece na query de recebidas para usuário autorizado simulado', appearsForAuthorized > 0 ? 'sim' : 'não')
    const assigned = resolveExperienceEvaluationAssignedEvaluator(solicitation.payload)
    const payloadAny = (solicitation.payload ?? {}) as any
    print('payload.campos', JSON.stringify(payloadAny.campos ?? {}, null, 2))
    print('payload.avaliacaoGestor', JSON.stringify(payloadAny.avaliacaoGestor ?? {}, null, 2))
    print('gestorImediatoAvaliadorId', assigned.id || '-')
    print('gestorImediatoAvaliador', assigned.fullName || '-')
    print('avaliadorId', assigned.id || '-')
    print('avaliador', assigned.fullName || '-')
    print('gestorId', assigned.id || '-')
    print('gestor', assigned.fullName || '-')
    print('payload tem dados de avaliação', fields.length > 0 ? 'sim' : 'não')
    print('campos da avaliação existentes', fields.join(', ') || '-')
    print('avaliador esperado consegue concluir', String(solicitation.status) === 'AGUARDANDO_AVALIACAO_GESTOR' && Boolean(solicitation.approverId || assigned.id || assigned.login || assigned.email || assigned.fullName) ? 'sim' : 'não')
    print('RH/DP consegue visualizar', appearsForAuthorized > 0 ? 'sim' : 'não')
    print('RH/DP consegue imprimir PDF', pdfAllowedByStatus && hasExperienceEvaluationPrintableData(solicitation.payload) ? 'sim' : 'não')
    print('RH/DP consegue finalizar', String(solicitation.status) === EXPERIENCE_EVALUATION_FINALIZATION_STATUS ? 'sim' : 'não')
    print('avaliadoEm normalizado', normalized.avaliadoEm)
    print('motivo objetivo do bloqueio', probableMissingReason(solicitation))
    print('sugestão de correção', hasExperienceEvaluationPrintableData(solicitation.payload) ? 'Rodar avaliacoes:fix-stuck -- --protocol '+protocolo+' --apply para devolver ao RH/DP se necessário.' : 'Garantir approverId/aliases do avaliador e reenviar para avaliação do gestor.')
  }
}

main()
  .catch((error) => {
    console.error('Falha no diagnóstico:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
