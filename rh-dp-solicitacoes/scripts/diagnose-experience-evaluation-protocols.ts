import { PrismaClient } from '@prisma/client'
import { buildReceivedSolicitationVisibilityWhere } from '@/lib/solicitationVisibility'
import {
  EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
  hasExperienceEvaluationPrintableData,
  normalizeExperienceEvaluationPayload,
} from '@/lib/experienceEvaluation'

const prisma = new PrismaClient()

const DEFAULT_PROTOCOLS = [
  'RQ2026-00203',
  'RQ2026-00210',
  'RQ2026-00657',
  'RQ2026-00763',
  'RQ2026-01234',
  'RQ2026-01395',
]

const protocols = process.argv.slice(2).filter(Boolean)
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
  if (solicitation.tipoId !== EXPERIENCE_EVALUATION_TIPO_ID) return 'Não é RQ_RH_103.'
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
    userSetorKeys: [],
    finalizerTipoIds: [EXPERIENCE_EVALUATION_TIPO_ID],
    allowedTipoIds: [EXPERIENCE_EVALUATION_TIPO_ID],
    viewerTipoIds: [EXPERIENCE_EVALUATION_TIPO_ID],
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
      solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID &&
      solicitation.status !== 'CANCELADA' &&
      [EXPERIENCE_EVALUATION_FINALIZATION_STATUS, 'CONCLUIDA', 'FINALIZADA'].includes(String(solicitation.status))

    print('id', solicitation.id)
    print('tipoId', solicitation.tipoId)
    print('tipo nome/código', `${solicitation.tipo?.nome ?? '-'} / ${solicitation.tipo?.codigo ?? '-'}`)
    print('status', solicitation.status)
    print('solicitante', solicitation.solicitante?.fullName)
    print('setor responsável', solicitation.department?.name)
    print('responsável atual', solicitation.assumidaPor?.fullName ?? '-')
    print('approver', solicitation.approver?.fullName ?? '-')
    print('assumidaPor', solicitation.assumidaPor?.fullName ?? '-')
    print('data abertura', solicitation.dataAbertura?.toISOString())
    print('data fechamento', solicitation.dataFechamento?.toISOString() ?? '-')
    print('aparece na query de recebidas para usuário autorizado simulado', appearsForAuthorized > 0 ? 'sim' : 'não')
    print('payload tem dados de avaliação', fields.length > 0 ? 'sim' : 'não')
    print('campos da avaliação existentes', fields.join(', ') || '-')
    print('PDF pode ser gerado pela regra de status/dados', pdfAllowedByStatus && hasExperienceEvaluationPrintableData(solicitation.payload) ? 'sim' : 'não')
    print('avaliadoEm normalizado', normalized.avaliadoEm)
    print('motivo provável de não aparecer', probableMissingReason(solicitation))
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
