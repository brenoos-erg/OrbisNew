require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } })
require('tsconfig-paths/register')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { buildSolicitationDetailPayload } = require('../src/lib/solicitationDetailPayload')
const policy = require('../src/lib/solicitationAccessPolicy')

function baseItem(overrides = {}) {
  return {
    id: 'sol-1',
    protocolo: 'RQ_RH_103',
    titulo: 'Solicitação antiga',
    descricao: null,
    status: 'ABERTA',
    tipoId: 'RQ_RH_103',
    solicitanteId: 'user-solicitante',
    payload: null,
    dataAbertura: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

const emptyPermissions = {
  viewerOnly: false,
  canAssume: false,
  canEdit: false,
  canApprove: false,
  canFinalize: false,
  canCancel: false,
  canComment: false,
}

function build(overrides = {}) {
  return buildSolicitationDetailPayload({
    item: baseItem(overrides.item),
    tipo: overrides.tipo === undefined ? { id: 'RQ_RH_103', codigo: 'RQ_RH_103', nome: 'Solicitação de admissão', schemaJson: null } : overrides.tipo,
    approver: overrides.approver === undefined ? null : overrides.approver,
    assumidaPor: overrides.assumidaPor === undefined ? null : overrides.assumidaPor,
    costCenter: overrides.costCenter === undefined ? null : overrides.costCenter,
    department: overrides.department === undefined ? null : overrides.department,
    nonConformity: null,
    comentarios: overrides.comentarios === undefined ? null : overrides.comentarios,
    eventos: overrides.eventos === undefined ? null : overrides.eventos,
    timelines: overrides.timelines === undefined ? null : overrides.timelines,
    solicitacaoSetores: overrides.solicitacaoSetores === undefined ? null : overrides.solicitacaoSetores,
    children: overrides.children === undefined ? null : overrides.children,
    documents: overrides.documents === undefined ? null : overrides.documents,
    attachments: overrides.attachments === undefined ? null : overrides.attachments,
    experienceEvaluators: [],
    permissions: overrides.permissions ?? emptyPermissions,
  })
}

const payloadNull = build({ item: { payload: null } })
assert.equal(typeof payloadNull.payload.campos, 'object', 'payload null deve virar objeto seguro')
assert.deepEqual(payloadNull.anexos, [], 'anexos nulos devem virar array vazio')
assert.deepEqual(payloadNull.comentarios, [], 'comentários nulos devem virar array vazio')
assert.deepEqual(payloadNull.timelines, [], 'timelines nulas devem virar array vazio')

const schemaNull = build({ tipo: { id: 'NADA_CONSTA', codigo: 'NADA_CONSTA', nome: 'Nada Consta', schemaJson: null } })
assert.deepEqual(schemaNull.tipo.schemaJson.camposEspecificos, [], 'schemaJson null deve expor campos vazios')

const tipoNull = build({ tipo: null, approver: null, assumidaPor: null, department: null, costCenter: null })
assert.equal(tipoNull.tipo, null, 'tipo nulo não deve quebrar')
assert.equal(tipoNull.responsavelAtual, null, 'approver/assumidaPor nulos não devem quebrar')
assert.equal(tipoNull.department, null, 'department nulo não deve quebrar')
assert.equal(tipoNull.costCenter, null, 'costCenter nulo não deve quebrar')

const experiencia = build({
  item: { tipoId: 'AVALIACAO_PERIODO_EXPERIENCIA', status: 'AGUARDANDO_AVALIACAO_GESTOR', payload: { campos: { avaliador: 'Gestor' } } },
  tipo: { id: 'AVALIACAO_PERIODO_EXPERIENCIA', codigo: 'AVALIACAO_PERIODO_EXPERIENCIA', nome: 'Avaliação do período de experiência', schemaJson: { camposEspecificos: null } },
})
assert.equal(experiencia.tipo.nome, 'Avaliação do período de experiência')
assert.deepEqual(experiencia.tipo.schemaJson.camposEspecificos, [])

const nadaConsta = build({
  item: { tipoId: 'NADA_CONSTA', protocolo: 'NADA-CONSTA-1', payload: { campos: { matricula: '1' } } },
  tipo: { id: 'NADA_CONSTA', codigo: 'NADA_CONSTA', nome: 'Nada Consta', schemaJson: { meta: { departamentos: null } } },
  solicitacaoSetores: [{ id: 'setor-1', setor: 'DP', status: 'PENDENTE', campos: null }],
})
assert.equal(nadaConsta.protocolo, 'NADA-CONSTA-1')
assert.deepEqual(nadaConsta.solicitacaoSetores[0].campos, {})

const viewerCtx = {
  userId: 'viewer',
  role: 'COLABORADOR',
  userDepartmentIds: [],
  userSetorKeys: [],
  finalizerTipoIds: [],
  allowedTipoIds: ['TIPO_VIEW'],
  viewerTipoIds: ['TIPO_VIEW'],
  actionableTipoIds: [],
  isExperienceEvaluationCoordinator: false,
}
const viewerSolicitation = { tipoId: 'TIPO_VIEW', status: 'ABERTA', solicitanteId: 'other', payload: {} }
assert.equal(policy.canViewSolicitation(viewerCtx, viewerSolicitation), true, 'visualizador deve abrir detalhe completo')
assert.equal(policy.isViewerOnlyByPolicy(viewerCtx, viewerSolicitation), true, 'visualizador deve receber viewerOnly=true')
assert.equal(policy.canAssumeSolicitation(viewerCtx, viewerSolicitation), false, 'visualizador não assume')
assert.equal(policy.canEditSolicitation(viewerCtx, viewerSolicitation), false, 'visualizador não edita')
assert.equal(policy.canApproveSolicitation(viewerCtx, viewerSolicitation), false, 'visualizador não aprova')
assert.equal(policy.canFinalizeSolicitation(viewerCtx, viewerSolicitation), false, 'visualizador não finaliza')
assert.equal(policy.canCommentSolicitation(viewerCtx, viewerSolicitation), false, 'visualizador não comenta')

const approverCtx = { ...viewerCtx, viewerTipoIds: [], allowedTipoIds: ['TIPO_VIEW'], actionableTipoIds: ['TIPO_VIEW'] }
assert.equal(policy.canAssumeSolicitation(approverCtx, viewerSolicitation), true, 'aprovador continua podendo agir')
assert.equal(policy.canEditSolicitation(approverCtx, viewerSolicitation), true, 'aprovador continua podendo editar/comentar')

const adminCtx = { ...viewerCtx, role: 'ADMIN', viewerTipoIds: ['TIPO_VIEW'] }
assert.equal(policy.canAssumeSolicitation(adminCtx, viewerSolicitation), true, 'admin continua podendo agir')
assert.equal(policy.canFinalizeSolicitation(adminCtx, viewerSolicitation), true, 'admin continua podendo finalizar')

const modalSource = fs.readFileSync('src/components/solicitacoes/SolicitationDetailModal.tsx', 'utf8')
assert.match(modalSource, /apiCanAssume/, 'frontend deve ler canAssume')
assert.match(modalSource, /apiCanComment/, 'frontend deve ler canComment')
assert.match(modalSource, /apiCanApprove/, 'frontend deve ler canApprove')
assert.match(modalSource, /apiCanFinalize/, 'frontend deve ler canFinalize')
assert.match(modalSource, /showManagementActions = !isApprovalMode && canManage && !isViewerOnly/, 'frontend deve ocultar ações para viewerOnly')

console.log('solicitation-detail-payload.test.cjs ok')
