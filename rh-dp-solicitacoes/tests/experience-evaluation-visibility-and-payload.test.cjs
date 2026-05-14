require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
require('tsconfig-paths/register')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const { buildReceivedSolicitationVisibilityWhere } = require('../src/lib/solicitationVisibility')
const policy = require('../src/lib/solicitationAccessPolicy')
const { normalizeExperienceEvaluationPayload, hasExperienceEvaluationPrintableData } = require('../src/lib/experienceEvaluation')
const { buildSolicitationDetailPayload } = require('../src/lib/solicitationDetailPayload')

const baseCtx = {
  userId: 'rh-user',
  userLogin: 'rh.user',
  userEmail: 'rh@example.com',
  userFullName: 'RH User',
  role: 'COLABORADOR',
  userDepartmentIds: [],
  userSetorKeys: [],
  finalizerTipoIds: [],
  allowedTipoIds: [],
  viewerTipoIds: [],
  actionableTipoIds: [],
  isExperienceEvaluationCoordinator: false,
  isRhAuthorizedForExperienceEvaluation: false,
  hasSolicitationsModuleAccess: true,
}

const concluded = {
  tipoId: 'RQ_RH_103',
  status: 'CONCLUIDA',
  solicitanteId: 'requester',
  approverId: null,
  assumidaPorId: null,
  payload: { campos: { gestorImediatoAvaliadorId: 'manager' } },
}

assert.equal(policy.canViewSolicitation({ ...baseCtx, isExperienceEvaluationCoordinator: true }, concluded), true, 'coordenador consulta RQ_RH_103 concluída')
assert.equal(policy.canViewSolicitation({ ...baseCtx, finalizerTipoIds: ['RQ_RH_103'] }, concluded), true, 'finalizador consulta RQ_RH_103 concluída')
assert.equal(policy.canViewSolicitation({ ...baseCtx, viewerTipoIds: ['RQ_RH_103'], allowedTipoIds: ['RQ_RH_103'] }, concluded), true, 'visualizador configurado consulta RQ_RH_103 concluída')
assert.equal(policy.canViewSolicitation(baseCtx, concluded), false, 'usuário sem relação não consulta RQ_RH_103 concluída')
assert.equal(policy.canPrintExperienceEvaluationPdf({ ...baseCtx, isExperienceEvaluationCoordinator: true }, concluded), true, 'PDF concluído usa canView/canPrint, não canFinalize')
assert.equal(policy.canFinalizeSolicitation({ ...baseCtx, isExperienceEvaluationCoordinator: true }, concluded), false, 'concluído não pode ser finalizado novamente')

const where = buildReceivedSolicitationVisibilityWhere({
  ...baseCtx,
  finalizerTipoIds: ['RQ_RH_103'],
  allowedTipoIds: ['RQ_RH_103'],
  viewerTipoIds: ['RQ_RH_103'],
  isExperienceEvaluationCoordinator: true,
})
assert.match(JSON.stringify(where), /CONCLUIDA/, 'query de recebidas inclui RQ_RH_103 CONCLUIDA para usuário autorizado')
assert.match(JSON.stringify(where), /FINALIZADA/, 'query de recebidas inclui RQ_RH_103 FINALIZADA para compatibilidade')

const managerCtx = { ...baseCtx, userId: 'manager', isExperienceEvaluationCoordinator: false }
assert.equal(policy.canViewSolicitation(managerCtx, concluded), true, 'gestor avaliador envolvido consulta concluída por payload mesmo sem responsável atual')

const legacyPayload = JSON.stringify({
  formulario: { colaborador: 'Pessoa Avaliada', setor: 'RH' },
  respostas: { relacionamento: 5, comunicacaoNota: '4', comentarioFinal: 'Aprovado' },
  avaliacao: { avaliadoEm: '2026-05-06T18:05:16.000Z' },
})
const normalizedLegacy = normalizeExperienceEvaluationPayload(legacyPayload)
assert.equal(normalizedLegacy.colaboradorAvaliado, 'Pessoa Avaliada')
assert.equal(normalizedLegacy.relacionamentoNota, '5')
assert.equal(normalizedLegacy.comunicacaoNota, '4')
assert.equal(normalizedLegacy.comentarioFinal, 'Aprovado')
assert.equal(normalizedLegacy.avaliadoEm, '2026-05-06T18:05:16.000Z')
assert.equal(normalizeExperienceEvaluationPayload(null).colaboradorAvaliado, '-', 'payload null não quebra e usa traço')
assert.equal(normalizeExperienceEvaluationPayload({}).autogestaoGestaoPessoasNota, '-', 'campo novo sem resposta aparece como traço')
assert.equal(hasExperienceEvaluationPrintableData({}), false, 'traços de fallback não contam como dados imprimíveis')

const detail = buildSolicitationDetailPayload({
  item: { id: 's1', protocolo: 'RQ2026-01234', tipoId: 'RQ_RH_103', status: 'CONCLUIDA', payload: legacyPayload, solicitanteId: 'requester' },
  tipo: { id: 'RQ_RH_103', codigo: 'RQ.RH.103', nome: 'Avaliação do período de experiência', schemaJson: null },
  permissions: { viewerOnly: false, canAssume: false, canEdit: false, canApprove: false, canFinalize: false, canCancel: false, canManageCancellationRequest: false, canComment: false, canPrintExperienceEvaluationPdf: true },
})
assert.equal(detail.payload.campos.constructor, Object, 'detalhe normaliza payload string com campos seguro')
assert.equal(detail.canPrintExperienceEvaluationPdf, true, 'detalhe expõe permissão de PDF concluído')

const pdfRoute = fs.readFileSync('src/app/api/solicitacoes/[id]/avaliacao-pdf/route.ts', 'utf8')
assert.match(pdfRoute, /FINALIZADA/, 'PDF aceita FINALIZADA se status legado existir')
assert.doesNotMatch(pdfRoute, /canFinalizeSolicitation/, 'PDF não depende de canFinalize')

const diagnoseScript = fs.readFileSync('scripts/diagnose-experience-evaluation-protocols.ts', 'utf8')
assert.match(diagnoseScript, /RQ2026-01234/, 'script de diagnóstico lista protocolos informados')
assert.match(diagnoseScript, /motivo provável de não aparecer/, 'script de diagnóstico imprime causa provável')

const reassignScript = fs.readFileSync('scripts/reassign-experience-evaluation-coordinator.ts', 'utf8')
assert.match(reassignScript, /Coordenador da avaliação alterado de/, 'script de reatribuição registra histórico')
assert.match(reassignScript, /patchExperienceEvaluationEvaluatorPayload/, 'script de reatribuição atualiza campos corretos do avaliador')

console.log('experience-evaluation-visibility-and-payload.test.cjs ok')
