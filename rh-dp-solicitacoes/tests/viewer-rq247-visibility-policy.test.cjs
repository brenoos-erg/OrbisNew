require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
require('tsconfig-paths/register')
const assert = require('node:assert/strict')

const {
  buildReceivedWhereByPolicy,
  canViewSolicitation,
  isViewerOnlyByPolicy,
  canAssumeSolicitation,
  canApproveSolicitation,
  canFinalizeSolicitation,
  canEditSolicitation,
  canCancelSolicitation,
} = require('../src/lib/solicitationAccessPolicy')
const { applyReceivedSectorVisibilityFilter } = require('../src/lib/receivedSolicitationsQuery')

const TIPO_RQ247 = 'RQ_247_DESLIGAMENTO'

const ctxFabiana = {
  userId: 'fabiana-id',
  userLogin: 'fabiana.carvalho',
  userEmail: 'fabiana@empresa.com',
  userFullName: 'Fabiana Otacilia de Carvalho',
  role: 'RH',
  userDepartmentIds: ['dep-rh'],
  userCostCenterIds: ['cc-rh'],
  userDepartmentNamesNormalized: ['recursos humanos'],
  userSectorNamesNormalized: ['rh'],
  userSetorKeys: ['RH'],
  finalizerTipoIds: [],
  allowedTipoIds: [],
  viewerTipoIds: [TIPO_RQ247],
  actionableTipoIds: [],
  isExperienceEvaluationCoordinator: false,
  isRhAuthorizedForExperienceEvaluation: true,
  hasSolicitationsModuleAccess: true,
}

const solicitacaoRQ247DP = {
  id: 'sol-1',
  tipoId: TIPO_RQ247,
  status: 'EM_ANALISE',
  solicitanteId: 'solicitante-dp',
  approverId: 'aprovador-dp',
  assumidaPorId: null,
  departmentId: 'dep-dp',
  costCenterId: 'cc-dp',
  solicitacaoSetores: [{ setor: 'DP' }],
}

const where = buildReceivedWhereByPolicy(ctxFabiana)
const whereJson = JSON.stringify(where)
assert.match(whereJson, new RegExp(TIPO_RQ247), 'buildReceivedWhereByPolicy precisa incluir tipo de viewer individual')

assert.equal(
  canViewSolicitation(ctxFabiana, solicitacaoRQ247DP),
  true,
  'Fabiana (viewer do tipo) deve visualizar solicitação RQ.247 do DP',
)

const visibleRows = applyReceivedSectorVisibilityFilter([solicitacaoRQ247DP], {
  normalizedSectorNames: ctxFabiana.userSectorNamesNormalized,
  departmentIds: ctxFabiana.userDepartmentIds,
  costCenterIds: ctxFabiana.userCostCenterIds,
  viewerTipoIds: ctxFabiana.viewerTipoIds,
})
assert.equal(visibleRows.length, 1, 'filtro pós-consulta não pode remover exceção VIEWER por tipo')

assert.equal(isViewerOnlyByPolicy(ctxFabiana, solicitacaoRQ247DP), true, 'viewer-only deve ser true nesse cenário')
assert.equal(canAssumeSolicitation(ctxFabiana, solicitacaoRQ247DP), false, 'viewer-only não pode assumir')
assert.equal(canApproveSolicitation(ctxFabiana, solicitacaoRQ247DP), false, 'viewer-only não pode aprovar')
assert.equal(canFinalizeSolicitation(ctxFabiana, solicitacaoRQ247DP), false, 'viewer-only não pode finalizar')
assert.equal(canEditSolicitation(ctxFabiana, solicitacaoRQ247DP), false, 'viewer-only não pode editar')
assert.equal(canCancelSolicitation(ctxFabiana, solicitacaoRQ247DP), false, 'viewer-only não pode cancelar')

const ctxRhSemViewer = { ...ctxFabiana, userId: 'outro-rh', viewerTipoIds: [] }
assert.equal(
  canViewSolicitation(ctxRhSemViewer, solicitacaoRQ247DP),
  false,
  'usuário RH sem VIEWER individual não pode ver solicitação DP desse tipo',
)

console.info('viewer-rq247-visibility-policy.test.cjs: ok')
