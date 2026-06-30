require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
require('tsconfig-paths/register')
const assert = require('node:assert/strict')

const { buildReceivedSolicitationVisibilityWhere, canUserViewSolicitationByDepartment } = require('../src/lib/solicitationVisibility')
const { resolveNadaConstaSetoresByDepartment } = require('../src/lib/solicitationTypes')

const base = {
  userId: 'u1', userLogin: 'u1', userEmail: 'u1@x.com', userFullName: 'User 1', role: 'COLABORADOR',
  userDepartmentIds: ['dep-dp'], userCostCenterIds: ['cc-1'], userDepartmentNamesNormalized: [], userSectorNamesNormalized: [],
  userSetorKeys: ['DP'], finalizerTipoIds: [], allowedTipoIds: ['TIPO_X'], viewerTipoIds: [],
  isExperienceEvaluationCoordinator: false, isRhAuthorizedForExperienceEvaluation: false,
}

const where = buildReceivedSolicitationVisibilityWhere(base)
const whereJson = JSON.stringify(where)
assert.doesNotMatch(whereJson, /costCenterId/, 'received não pode abrir por centro de custo')
assert.doesNotMatch(whereJson, /TIPO_X/, 'received não pode abrir por allowedTipoIds')

assert.equal(canUserViewSolicitationByDepartment(base, {
  tipoId: 'TIPO_X', solicitanteId: 'other', departmentId: 'dep-sst', solicitacaoSetores: [{ setor: 'SST' }],
}), false, 'APPROVER/allowed tipo não libera recebidas fora do setor')


assert.equal(canUserViewSolicitationByDepartment(base, {
  tipoId: 'TIPO_OUTRO', solicitanteId: 'other', departmentId: 'dep-sst', costCenterId: 'cc-1', solicitacaoSetores: [{ setor: 'SST' }],
}), true, 'fallback por centro de custo vinculado continua liberando visibilidade')

assert.equal(canUserViewSolicitationByDepartment({ ...base, viewerTipoIds: ['TIPO_VIEW'] }, {
  tipoId: 'TIPO_VIEW', solicitanteId: 'other', departmentId: 'dep-sst', solicitacaoSetores: [{ setor: 'SST' }],
}), true, 'VIEWER libera exceção individual fora do setor')

assert.deepEqual(resolveNadaConstaSetoresByDepartment({ code: '21', name: 'Saúde Ocupacional' }).includes('SAUDE'), true)
assert.deepEqual(resolveNadaConstaSetoresByDepartment({ code: '19', name: 'SST' }).includes('SAUDE'), false)

console.info('solicitation-visibility-notification-rules.test.cjs: ok')
