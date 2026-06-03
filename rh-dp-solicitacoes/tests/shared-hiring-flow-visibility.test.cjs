require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
require('tsconfig-paths/register')
const assert = require('node:assert/strict')

const { isSolicitacaoPessoal, isSolicitacaoAdmissao } = require('../src/lib/solicitationTypes.ts')
const { buildReceivedSolicitationVisibilityWhere, canUserViewSolicitationByDepartment } = require('../src/lib/solicitationVisibility')
const { canViewLinkedHiringFlow, canViewSensitiveHiringRequest } = require('../src/lib/sensitiveHiringRequests')

const rhAccess = {
  userId: 'rh-1', userLogin: 'rh', userEmail: 'rh@example.com', userFullName: 'Pessoa RH', role: 'RH',
  userDepartmentIds: ['dep-rh'], userCostCenterIds: [], userDepartmentNamesNormalized: ['recursos humanos'], userSectorNamesNormalized: ['rh'],
  userSetorKeys: ['RH'], finalizerTipoIds: [], allowedTipoIds: [], viewerTipoIds: [],
  isExperienceEvaluationCoordinator: false, isRhAuthorizedForExperienceEvaluation: true, isRhAuthorizedForSharedHiringFlow: true,
}

const otherAccess = {
  ...rhAccess,
  userId: 'other-1', role: 'COLABORADOR', userDepartmentIds: ['dep-ti'], userDepartmentNamesNormalized: ['ti'], userSectorNamesNormalized: ['ti'], userSetorKeys: ['TI'],
  isRhAuthorizedForExperienceEvaluation: false, isRhAuthorizedForSharedHiringFlow: false,
}

assert.equal(isSolicitacaoPessoal({ codigo: 'RQ.RH.063', nome: 'Outro nome' }), true, 'RQ.RH.063 deve identificar Solicitação de Pessoal')
assert.equal(isSolicitacaoAdmissao({ codigo: 'RQ.DP.001', nome: 'Outro nome' }), true, 'RQ.DP.001 deve identificar Solicitação de Admissão')

const pessoalNoDp = {
  tipoId: 'RQ_063', tipo: { id: 'RQ_063', codigo: 'RQ.RH.063', nome: 'Solicitação de Pessoal' },
  solicitanteId: 'requester', assumidaPorId: null, approverId: null, departmentId: 'dep-dp', status: 'EM_ATENDIMENTO',
  payload: { dpStatus: 'PENDENTE', dpHandoffAt: '2026-06-01T10:00:00.000Z' }, solicitacaoSetores: [],
}

assert.equal(canUserViewSolicitationByDepartment(rhAccess, pessoalNoDp), true, 'RH autorizado deve acompanhar RQ_063 após envio ao DP')
assert.equal(canUserViewSolicitationByDepartment(otherAccess, pessoalNoDp), false, 'Outro setor não deve acompanhar RQ_063 no DP')

const admissaoVinculada = {
  tipoId: 'SOLICITACAO_ADMISSAO', tipo: { id: 'SOLICITACAO_ADMISSAO', codigo: 'RQ.DP.001', nome: 'Solicitação de Admissão' },
  parentId: 'rq063-1', parent: { tipoId: 'RQ_063', tipo: { codigo: 'RQ.RH.063', nome: 'Solicitação de Pessoal' } },
  solicitanteId: 'requester', assumidaPorId: null, approverId: null, departmentId: 'dep-dp', payload: {}, solicitacaoSetores: [],
}

assert.equal(canViewLinkedHiringFlow({ user: { id: 'rh-1', role: 'RH' }, isRhAuthorized: true, solicitation: admissaoVinculada }), true, 'RH deve ver admissão vinculada à RQ_063')
assert.equal(canUserViewSolicitationByDepartment(rhAccess, admissaoVinculada), true, 'Listagem deve permitir admissão vinculada para acompanhamento RH')

const admissaoSolta = {
  ...admissaoVinculada,
  parentId: null,
  parent: null,
  payload: {},
}

assert.equal(canViewLinkedHiringFlow({ user: { id: 'rh-1', role: 'RH' }, isRhAuthorized: true, solicitation: admissaoSolta }), false, 'RH não deve ganhar acesso a admissão sem vínculo')
assert.equal(canUserViewSolicitationByDepartment(rhAccess, admissaoSolta), false, 'Listagem não deve liberar admissão sem vínculo')
assert.equal(canViewSensitiveHiringRequest({ user: { id: 'rh-1', role: 'RH' }, isRhAuthorizedForSharedHiringFlow: true, solicitation: { tipo: admissaoSolta.tipo } }), false, 'Regra sensível não deve liberar todo chamado sensível só por ser RH')

const whereJson = JSON.stringify(buildReceivedSolicitationVisibilityWhere(rhAccess))
assert.match(whereJson, /RQ_063/, 'Where da listagem deve conter exceção específica para RQ_063')
assert.match(whereJson, /SOLICITACAO_ADMISSAO/, 'Where da listagem deve conter admissão vinculada')
assert.doesNotMatch(whereJson, /parentId\":\{\"not\":null\}/, 'Where não deve liberar qualquer registro com parentId para RH')

console.info('shared-hiring-flow-visibility.test.cjs: ok')
