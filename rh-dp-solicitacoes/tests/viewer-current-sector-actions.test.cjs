require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } })
require('tsconfig-paths/register')
const assert = require('node:assert/strict')

let mockedSolicitation = null
const prismaMock = {
  solicitation: {
    findUnique: async () => mockedSolicitation,
  },
  user: {
    findUnique: async () => ({
      id: 'viewer-logistica',
      login: 'viewer.logistica',
      email: 'viewer@example.test',
      fullName: 'Viewer Logística',
      role: 'COLABORADOR',
      departmentId: 'dept-logistica',
      department: { id: 'dept-logistica', code: 'LOG', name: 'Logística' },
      costCenterId: 'cc-logistica',
      costCenter: { id: 'cc-logistica', code: 'CCLOG', externalCode: null, abbreviation: 'LOG', description: 'Logística', department: { id: 'dept-logistica', code: 'LOG', name: 'Logística' } },
      costCenters: [],
      userDepartments: [],
      moduleAccesses: [{ level: 'NIVEL_1', module: { key: 'solicitacoes' } }],
    }),
  },
  tipoSolicitacaoApprover: {
    findMany: async ({ where }) => (where.role === 'VIEWER' ? [{ tipoId: 'RQ_SST_043' }] : []),
  },
  approverGroupMember: { findFirst: async () => null },
}

globalThis.prisma = prismaMock
const policy = require('../src/lib/solicitationAccessPolicy')
const { isViewerOnlyForSolicitation } = require('../src/lib/solicitationPermissionGuards')

function ctx(overrides = {}) {
  return {
    userId: 'viewer-logistica',
    role: 'COLABORADOR',
    userDepartmentIds: ['dept-logistica'],
    userCostCenterIds: ['cc-logistica'],
    userSetorKeys: ['LOGISTICA'],
    allowedTipoIds: ['RQ_SST_043'],
    viewerTipoIds: ['RQ_SST_043'],
    actionableTipoIds: [],
    finalizerTipoIds: [],
    isExperienceEvaluationCoordinator: false,
    isRhAuthorizedForExperienceEvaluation: false,
    hasSolicitationsModuleAccess: true,
    ...overrides,
  }
}

function sol(overrides = {}) {
  return {
    tipoId: 'RQ_SST_043',
    tipo: { id: 'RQ_SST_043', codigo: 'RQ.SST.043', nome: 'Solicitação de EPI / Uniformes' },
    status: 'EM_ATENDIMENTO',
    solicitanteId: 'solicitante',
    approverId: null,
    assumidaPorId: null,
    departmentId: 'dept-sst',
    costCenterId: 'cc-sst',
    solicitacaoSetores: [{ setor: 'SST', status: 'PENDENTE' }],
    payload: {},
    ...overrides,
  }
}

const outroSetor = sol()
assert.equal(policy.canViewSolicitation(ctx(), outroSetor), true, 'VIEWER vê solicitações do tipo em outro setor')
assert.equal(policy.isViewerOnlyByPolicy(ctx(), outroSetor), true, 'VIEWER em outro setor fica somente leitura')
assert.equal(policy.canAssumeSolicitation(ctx(), outroSetor), false, 'VIEWER em outro setor não assume')
assert.equal(policy.canEditSolicitation(ctx(), outroSetor), false, 'VIEWER em outro setor não edita')
assert.equal(policy.canApproveSolicitation(ctx(), outroSetor), false, 'VIEWER em outro setor não aprova')
assert.equal(policy.canFinalizeSolicitation(ctx(), outroSetor), false, 'VIEWER em outro setor não finaliza')
assert.equal(policy.canCommentSolicitation(ctx(), outroSetor), false, 'VIEWER em outro setor não comenta')

const departamentoAtual = sol({ departmentId: 'dept-logistica', solicitacaoSetores: [{ setor: 'LOGISTICA', status: 'PENDENTE' }] })
assert.equal(policy.canViewSolicitation(ctx(), departamentoAtual), true)
assert.equal(policy.isViewerOnlyByPolicy(ctx(), departamentoAtual), false, 'VIEWER deixa de ser somente leitura no próprio departamento')
assert.equal(policy.canAssumeSolicitation(ctx(), departamentoAtual), true, 'política normal do departamento pode assumir')
assert.equal(policy.canEditSolicitation(ctx(), departamentoAtual), true, 'política normal do departamento pode editar')
assert.equal(policy.canCommentSolicitation(ctx(), departamentoAtual), true, 'política normal do departamento pode comentar')
assert.equal(policy.canFinalizeSolicitation(ctx(), departamentoAtual), policy.canFinalizeSolicitation(ctx({ allowedTipoIds: [], viewerTipoIds: [] }), departamentoAtual), 'VIEWER no setor mantém resultado normal de finalização sem criar permissão nova')
assert.equal(policy.canApproveSolicitation(ctx(), departamentoAtual), false, 'VIEWER não vira aprovador apenas por estar no setor')

const departamentoAtualSemViewer = ctx({ allowedTipoIds: [], viewerTipoIds: [] })
for (const [name, fn] of Object.entries({
  canAssume: policy.canAssumeSolicitation,
  canEdit: policy.canEditSolicitation,
  canComment: policy.canCommentSolicitation,
  canFinalize: policy.canFinalizeSolicitation,
  canCancel: policy.canCancelSolicitation,
})) {
  assert.equal(fn(ctx(), departamentoAtual), fn(departamentoAtualSemViewer, departamentoAtual), `${name} no setor atual deve ser igual ao usuário equivalente sem VIEWER`)
}

const departamentoAtualStatusInicial = sol({ status: 'ABERTA', departmentId: 'dept-logistica', solicitacaoSetores: [{ setor: 'LOGISTICA', status: 'PENDENTE' }] })
assert.equal(policy.isViewerOnlyByPolicy(ctx(), departamentoAtualStatusInicial), false, 'VIEWER no setor atual não fica bloqueado pelo papel VIEWER')

const departamentoSecundario = sol({ departmentId: 'dept-logistica' })
assert.equal(policy.isViewerOnlyByPolicy(ctx({ userDepartmentIds: ['dept-rh', 'dept-logistica'] }), departamentoSecundario), false, 'departamento secundário é vínculo operacional')

const centroCustoAtual = sol({ costCenterId: 'cc-logistica' })
assert.equal(policy.isViewerOnlyByPolicy(ctx(), centroCustoAtual), false, 'centro de custo atual é vínculo operacional')

const setorOperacionalAtual = sol({ solicitacaoSetores: [{ setor: ' Logística ', status: 'PENDENTE' }] })
assert.equal(policy.isViewerOnlyByPolicy(ctx(), setorOperacionalAtual), false, 'solicitacaoSetores ativo do usuário é vínculo operacional')

const setorSecundarioAtivo = sol({ solicitacaoSetores: [{ setor: 'SST', status: 'PENDENTE' }, { setor: 'logistica-operacional', status: 'EM_ATENDIMENTO' }] })
assert.equal(policy.isViewerOnlyByPolicy(ctx({ userSetorKeys: ['LOGISTICA_OPERACIONAL'] }), setorSecundarioAtivo), false, 'setor secundário ativo normalizado deve liberar atuação')

const setorHistoricoConcluido = sol({ solicitacaoSetores: [{ setor: 'LOGISTICA', status: 'CONCLUIDO' }, { setor: 'SST', status: 'PENDENTE' }] })
assert.equal(policy.isViewerOnlyByPolicy(ctx(), setorHistoricoConcluido), true, 'setor histórico concluído não libera atuação')
assert.equal(policy.canEditSolicitation(ctx(), setorHistoricoConcluido), false, 'setor histórico concluído não libera edição')

const setorSecundarioConcluido = sol({ solicitacaoSetores: [{ setor: 'SST', status: 'PENDENTE' }, { setor: 'LOGISTICA', status: 'CONCLUIDO', finalizadoEm: '2026-01-01T00:00:00.000Z' }] })
assert.equal(policy.isViewerOnlyByPolicy(ctx(), setorSecundarioConcluido), true, 'setor secundário concluído não deve liberar atuação')

for (const status of ['CONCLUIDO', 'CONCLUIDA', 'FINALIZADO', 'FINALIZADA', 'CANCELADO', 'CANCELADA', 'ENCERRADO', 'ENCERRADA', 'RECUSADO', 'RECUSADA', 'REPROVADO', 'REPROVADA']) {
  assert.equal(policy.isSolicitationSectorActive({ status }), false, `status ${status} deve ser tratado como encerrado`)
}
assert.equal(policy.isSolicitationSectorActive({ status: '' }), true, 'status vazio legado é tratado como ativo por compatibilidade')

const saiuDoSetor = sol({ departmentId: 'dept-financeiro', costCenterId: 'cc-financeiro', solicitacaoSetores: [{ setor: 'FINANCEIRO', status: 'PENDENTE' }] })
assert.equal(policy.canViewSolicitation(ctx(), saiuDoSetor), true, 'VIEWER continua vendo após sair do setor')
assert.equal(policy.isViewerOnlyByPolicy(ctx(), saiuDoSetor), true, 'VIEWER volta a somente leitura após sair do setor')

const viewerApprover = ctx({ actionableTipoIds: ['RQ_SST_043'] })
assert.equal(policy.isViewerOnlyByPolicy(viewerApprover, outroSetor), false, 'VIEWER + APPROVER não é somente visualizador')
assert.equal(policy.canApproveSolicitation(viewerApprover, outroSetor), true, 'APPROVER aprova somente pela política própria de aprovação')
assert.equal(policy.canAssumeSolicitation(viewerApprover, outroSetor), false, 'VIEWER + APPROVER fora do setor não assume')
assert.equal(policy.canEditSolicitation(viewerApprover, outroSetor), false, 'VIEWER + APPROVER fora do setor não edita')
assert.equal(policy.canCommentSolicitation(viewerApprover, outroSetor), false, 'VIEWER + APPROVER fora do setor não comenta')
assert.equal(policy.canFinalizeSolicitation(viewerApprover, outroSetor), false, 'VIEWER + APPROVER fora do setor não finaliza')
assert.equal(policy.canCancelSolicitation(viewerApprover, outroSetor), false, 'VIEWER + APPROVER fora do setor não cancela')

const approverAtualForaSetor = sol({ approverId: 'viewer-logistica' })
assert.equal(policy.isViewerOnlyByPolicy(ctx(), approverAtualForaSetor), false, 'approverId atual pode sair do modo viewerOnly')
assert.equal(policy.canApproveSolicitation(ctx(), approverAtualForaSetor), true, 'approverId atual pode aprovar quando aplicável')
assert.equal(policy.canCommentSolicitation(ctx(), approverAtualForaSetor), true, 'approverId atual pode comentar conforme comportamento anterior')
assert.equal(policy.canEditSolicitation(ctx(), approverAtualForaSetor), false, 'approverId fora do setor não ganha edição operacional')
assert.equal(policy.canFinalizeSolicitation(ctx(), approverAtualForaSetor), false, 'approverId fora do setor não ganha finalização operacional')
assert.equal(policy.canCancelSolicitation(ctx(), approverAtualForaSetor), false, 'approverId fora do setor não ganha cancelamento operacional')


const solicitanteForaSetor = sol({ solicitanteId: 'viewer-logistica' })
assert.equal(policy.isViewerOnlyByPolicy(ctx(), solicitanteForaSetor), false, 'solicitante com VIEWER não pode ficar em modo somente leitura quando possui ação legítima de comentário')
assert.equal(policy.canCommentSolicitation(ctx(), solicitanteForaSetor), true, 'solicitante pode comentar conforme comportamento anterior')
assert.equal(policy.canEditSolicitation(ctx(), solicitanteForaSetor), false, 'solicitante fora do setor não ganha edição operacional')
assert.equal(policy.canFinalizeSolicitation(ctx(), solicitanteForaSetor), false, 'solicitante fora do setor não ganha finalização operacional')

const finalizadaParaComentario = sol({ status: 'CONCLUIDA', departmentId: 'dept-logistica', solicitacaoSetores: [{ setor: 'LOGISTICA', status: 'PENDENTE' }] })
assert.equal(policy.canCommentSolicitation(ctx(), finalizadaParaComentario), false, 'solicitação finalizada não aceita comentário')
const canceladaParaComentario = sol({ status: 'CANCELADA', departmentId: 'dept-logistica', solicitacaoSetores: [{ setor: 'LOGISTICA', status: 'PENDENTE' }] })
assert.equal(policy.canCommentSolicitation(ctx(), canceladaParaComentario), false, 'solicitação cancelada não aceita comentário')

const viewerFinalizer = ctx({ finalizerTipoIds: ['RQ_SST_043'] })
assert.equal(policy.isViewerOnlyByPolicy(viewerFinalizer, outroSetor), true, 'VIEWER + FINALIZER fora de etapa válida continua somente visualizador')
assert.equal(policy.canFinalizeSolicitation(viewerFinalizer, outroSetor), false, 'FINALIZER não finaliza etapa indevida sem regra de finalização válida')

const assumido = sol({ assumidaPorId: 'viewer-logistica' })
assert.equal(policy.isViewerOnlyByPolicy(ctx(), assumido), false, 'usuário que assumiu não fica preso como VIEWER')

assert.equal(policy.canEditSolicitation(ctx(), assumido), true, 'usuário que assumiu executa ações normais de responsável')
assert.equal(policy.canCommentSolicitation(ctx(), assumido), true, 'usuário que assumiu pode comentar pela política normal')

assert.equal(policy.isViewerOnlyByPolicy(ctx({ role: 'ADMIN' }), outroSetor), false, 'administrador nunca fica viewerOnly')
assert.equal(policy.canAssumeSolicitation(ctx({ role: 'ADMIN' }), outroSetor), true, 'administrador preserva atuação')

const semViewerForaDoSetor = ctx({ allowedTipoIds: [], viewerTipoIds: [], actionableTipoIds: [], finalizerTipoIds: [] })
assert.equal(policy.canViewSolicitation(semViewerForaDoSetor, outroSetor), false, 'usuário sem VIEWER fora do setor não ganha visibilidade')

async function assertBackendGuardUsesSamePolicy() {
  mockedSolicitation = outroSetor
  assert.equal(await isViewerOnlyForSolicitation({ solicitationId: 'sol-outro', userId: 'viewer-logistica', prismaClient: prismaMock, userAccessContext: ctx() }), true, 'guard backend bloqueia VIEWER fora do setor ativo')

  mockedSolicitation = departamentoAtual
  assert.equal(await isViewerOnlyForSolicitation({ solicitationId: 'sol-logistica', userId: 'viewer-logistica', prismaClient: prismaMock, userAccessContext: ctx() }), false, 'guard backend não retorna erro genérico de VIEWER no setor ativo')

  mockedSolicitation = setorHistoricoConcluido
  assert.equal(await isViewerOnlyForSolicitation({ solicitationId: 'sol-historico', userId: 'viewer-logistica', prismaClient: prismaMock, userAccessContext: ctx() }), true, 'guard backend ignora setor histórico concluído')

  mockedSolicitation = solicitanteForaSetor
  assert.equal(await isViewerOnlyForSolicitation({ solicitationId: 'sol-solicitante', userId: 'viewer-logistica', prismaClient: prismaMock, userAccessContext: ctx() }), false, 'guard backend não bloqueia solicitante VIEWER antes da política de comentário')
}

assertBackendGuardUsesSamePolicy()
  .then(() => console.log('✅ viewer-current-sector-actions.test passed'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
