require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
require('tsconfig-paths/register')
const assert = require('node:assert/strict')

const {
  buildReceivedWhereByPolicy,
  canViewSolicitation,
  canAssumeSolicitation,
  canEditSolicitation,
} = require('../src/lib/solicitationAccessPolicy')
const { applyReceivedSectorVisibilityFilter } = require('../src/lib/receivedSolicitationsQuery')

const ctxRh = {
  userId: 'rh-user',
  userLogin: 'rh.user',
  userEmail: 'rh@empresa.com',
  userFullName: 'Pessoa RH',
  role: 'RH',
  userDepartmentIds: ['dep-rh'],
  userCostCenterIds: ['cc-rh'],
  userDepartmentNamesNormalized: ['recursos humanos'],
  userSectorNamesNormalized: ['rh', 'recursos humanos'],
  userSetorKeys: ['RH'],
  finalizerTipoIds: [],
  allowedTipoIds: [],
  viewerTipoIds: [],
  actionableTipoIds: [],
  isExperienceEvaluationCoordinator: false,
  isRhAuthorizedForExperienceEvaluation: true,
  isRhAuthorizedForSharedHiringFlow: true,
  hasSolicitationsModuleAccess: true,
}

const ctxDp = {
  ...ctxRh,
  userId: 'dp-user',
  role: 'COLABORADOR',
  userDepartmentIds: ['dep-dp'],
  userCostCenterIds: ['cc-dp'],
  userDepartmentNamesNormalized: ['departamento pessoal'],
  userSectorNamesNormalized: ['dp', 'departamento pessoal'],
  userSetorKeys: ['DP'],
  isRhAuthorizedForExperienceEvaluation: false,
  isRhAuthorizedForSharedHiringFlow: false,
}

const ctxOther = {
  ...ctxDp,
  userId: 'financeiro-user',
  userDepartmentIds: ['dep-fin'],
  userCostCenterIds: ['cc-fin'],
  userDepartmentNamesNormalized: ['financeiro'],
  userSectorNamesNormalized: ['financeiro'],
  userSetorKeys: ['FINANCEIRO'],
}

const rq063Rh = {
  id: 'rq063-rh',
  tipoId: 'RQ_063',
  tipo: { codigo: 'RQ.RH.063', nome: 'Solicitação de Pessoal' },
  status: 'EM_ATENDIMENTO',
  solicitanteId: 'solicitante',
  approverId: null,
  assumidaPorId: null,
  departmentId: 'dep-rh',
  costCenterId: 'cc-rh',
  payload: {},
  solicitacaoSetores: [{ setor: 'RH' }],
}

const rq063Dp = {
  ...rq063Rh,
  id: 'rq063-dp',
  departmentId: 'dep-dp',
  costCenterId: 'cc-dp',
  payload: { dpStatus: 'PENDENTE', dpHandoffAt: '2026-05-01T10:00:00.000Z' },
  solicitacaoSetores: [{ setor: 'DP' }],
}

const rq063DpConcluida = {
  ...rq063Dp,
  id: 'rq063-dp-concluida',
  status: 'CONCLUIDA',
  payload: { dpStatus: 'CONCLUIDO', dpHandoffAt: '2026-05-01T10:00:00.000Z' },
}

const admissaoVinculada = {
  id: 'adm-vinculada',
  tipoId: 'SOLICITACAO_ADMISSAO',
  tipo: { codigo: 'RQ.DP.001', nome: 'Solicitação de Admissão' },
  status: 'CONCLUIDA',
  solicitanteId: 'dp-user',
  approverId: null,
  assumidaPorId: null,
  departmentId: 'dep-dp',
  costCenterId: 'cc-dp',
  parentId: 'rq063-dp',
  parent: { tipoId: 'RQ_063', tipo: { codigo: 'RQ.RH.063', nome: 'Solicitação de Pessoal' } },
  payload: { origem: { rhSolicitationId: 'rq063-dp' } },
  solicitacaoSetores: [{ setor: 'DP' }],
}

const admissaoSemVinculo = {
  ...admissaoVinculada,
  id: 'adm-sem-vinculo',
  parentId: null,
  parent: null,
  payload: {},
}

const chamadoComumConcluidoDp = {
  id: 'comum-dp',
  tipoId: 'RQ_999',
  tipo: { codigo: 'RQ.DP.999', nome: 'Chamado comum DP' },
  status: 'CONCLUIDA',
  solicitanteId: 'dp-user',
  approverId: null,
  assumidaPorId: null,
  departmentId: 'dep-dp',
  costCenterId: 'cc-dp',
  payload: {},
  solicitacaoSetores: [{ setor: 'DP' }],
}

const whereJson = JSON.stringify(buildReceivedWhereByPolicy(ctxRh))
assert.match(whereJson, /RQ_063/, 'política de recebidas deve incluir exceção RQ_063 para RH autorizado')
assert.match(whereJson, /SOLICITACAO_ADMISSAO/, 'política de recebidas deve incluir admissão vinculada para RH autorizado')

assert.equal(canViewSolicitation(ctxRh, rq063Rh), true, 'RH visualiza RQ_063 aberta no RH')
assert.equal(canViewSolicitation(ctxRh, rq063Dp), true, 'RH visualiza RQ_063 encaminhada ao DP')
assert.equal(canViewSolicitation(ctxRh, rq063DpConcluida), true, 'RH visualiza RQ_063 concluída pelo DP')
assert.equal(canViewSolicitation(ctxDp, rq063Dp), true, 'DP visualiza RQ_063 encaminhada ao DP pela regra atual')
assert.equal(canViewSolicitation(ctxDp, rq063DpConcluida), true, 'DP visualiza RQ_063 concluída no DP pela regra atual')
assert.equal(canViewSolicitation(ctxOther, rq063DpConcluida), false, 'setor sem vínculo não visualiza RQ_063 do RH/DP')
assert.equal(canViewSolicitation({ ...ctxOther, userId: rq063Dp.solicitanteId }, rq063Dp), true, 'solicitante original mantém visibilidade')
assert.equal(canViewSolicitation(ctxRh, admissaoVinculada), true, 'RH visualiza RQ.DP.001 vinculada a RQ_063')
assert.equal(canViewSolicitation(ctxRh, admissaoSemVinculo), false, 'RH não visualiza RQ.DP.001 sem vínculo')
assert.equal(canViewSolicitation(ctxRh, chamadoComumConcluidoDp), false, 'chamado comum concluído de outro setor continua invisível para RH')

const visibleForRh = applyReceivedSectorVisibilityFilter(
  [rq063Rh, rq063Dp, rq063DpConcluida, admissaoVinculada, admissaoSemVinculo, chamadoComumConcluidoDp],
  {
    normalizedSectorNames: ctxRh.userSectorNamesNormalized,
    departmentIds: ctxRh.userDepartmentIds,
    costCenterIds: ctxRh.userCostCenterIds,
    viewerTipoIds: ctxRh.viewerTipoIds,
    userSetorKeys: ctxRh.userSetorKeys,
    isRhAuthorizedForSharedHiringFlow: ctxRh.isRhAuthorizedForSharedHiringFlow,
  },
)
assert.deepEqual(
  visibleForRh.map((item) => item.id).sort(),
  ['adm-vinculada', 'rq063-dp', 'rq063-dp-concluida', 'rq063-rh'].sort(),
  'filtro em memória preserva apenas o fluxo compartilhado RH/DP e não abre demais chamados',
)

assert.equal(canAssumeSolicitation(ctxRh, rq063DpConcluida), false, 'acompanhamento RH não libera assumir após DP')
assert.equal(canEditSolicitation(ctxRh, rq063DpConcluida), false, 'acompanhamento RH não libera edição após conclusão no DP')

console.info('rq063-rh-dp-shared-visibility.test.cjs: ok')
