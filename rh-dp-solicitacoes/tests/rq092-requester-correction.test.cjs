const assert = require('node:assert/strict');
const {
  canRequesterEditRq092AfterSubmit,
  isRequesterEditableStatus,
} = require('../src/lib/solicitationAccessPolicy');
const { isSolicitacaoExamesSst } = require('../src/lib/solicitationTypes');
const { buildSolicitationDetailPayload } = require('../src/lib/solicitationDetailPayload');

const rq092Tipo = { id: 'RQ_092', codigo: 'RQ.SST.092', nome: 'Solicitação de exames' };

assert.equal(isSolicitacaoExamesSst(rq092Tipo), true, 'identifica RQ.092 pelos identificadores reais');
assert.equal(isSolicitacaoExamesSst({ id: 'OUTRO', codigo: 'RQ.092', nome: 'Legado' }), true, 'identifica código legado RQ.092');
assert.equal(isSolicitacaoExamesSst({ id: 'RQ_063', codigo: 'RQ.RH.063', nome: 'Solicitação de Pessoal' }), false, 'não confunde RQ.063 com RQ.092');

assert.equal(isRequesterEditableStatus('ABERTA'), true, 'status aberto permite correção');
assert.equal(isRequesterEditableStatus('EM_ATENDIMENTO'), true, 'status em atendimento permite correção');
assert.equal(isRequesterEditableStatus('CONCLUIDA'), false, 'status concluída bloqueia correção');
assert.equal(isRequesterEditableStatus('FINALIZADA'), false, 'status finalizada bloqueia correção');
assert.equal(isRequesterEditableStatus('CANCELADA'), false, 'status cancelada bloqueia correção');

const solicitation = {
  tipoId: 'RQ_092',
  tipo: rq092Tipo,
  solicitanteId: 'user-a',
  status: 'ABERTA',
};

assert.equal(canRequesterEditRq092AfterSubmit('user-a', solicitation), true, 'solicitante original edita RQ.092 aberta');
assert.equal(canRequesterEditRq092AfterSubmit('user-b', solicitation), false, 'outro usuário não edita RQ.092 do solicitante');
assert.equal(canRequesterEditRq092AfterSubmit('user-a', { ...solicitation, status: 'CONCLUIDA' }), false, 'nem solicitante edita concluída');
assert.equal(canRequesterEditRq092AfterSubmit('user-a', { ...solicitation, status: 'CANCELADA' }), false, 'nem solicitante edita cancelada');
assert.equal(
  canRequesterEditRq092AfterSubmit('user-a', { ...solicitation, tipoId: 'RQ_063', tipo: { id: 'RQ_063', codigo: 'RQ.RH.063', nome: 'Solicitação de Pessoal' } }),
  false,
  'outros tipos não ganham exceção',
);

const editedAt = '2026-06-02T10:35:00.000Z';
const detail = buildSolicitationDetailPayload({
  item: {
    id: 'sol-1',
    protocolo: 'RQ260602-0001',
    titulo: 'Solicitação de exames',
    status: 'ABERTA',
    tipoId: 'RQ_092',
    payload: { campos: { dataExame: '2026-06-03', unidade: 'Contagem' } },
  },
  tipo: { ...rq092Tipo, schemaJson: { camposEspecificos: [] } },
  timelines: [
    {
      id: 'tl-1',
      status: 'RQ092_CORRECAO_REALIZADA',
      createdAt: editedAt,
      message: JSON.stringify({
        type: 'RQ092_CORRECAO_REALIZADA',
        solicitationId: 'sol-1',
        protocolo: 'RQ260602-0001',
        actorId: 'user-a',
        actorName: 'João Silva',
        actorLogin: 'joao',
        actorEmail: 'joao@example.com',
        editedAt,
        justification: 'Correção de data do exame.',
        changes: [
          { fieldName: 'dataExame', label: 'Data do exame', oldValue: '2026-06-01', newValue: '2026-06-03' },
        ],
      }),
    },
  ],
  permissions: {
    viewerOnly: false,
    canAssume: false,
    canEdit: true,
    canApprove: false,
    canFinalize: false,
    canCancel: true,
    canManageCancellationRequest: false,
    canComment: true,
    canRequesterEditRq092: true,
  },
});

assert.equal(detail.canRequesterEditRq092, true, 'detalhe expõe permissão específica RQ.092');
assert.equal(detail.rq092Corrections.length, 1, 'detalhe expõe log especial de correções');
assert.equal(detail.rq092Corrections[0].actorName, 'João Silva', 'log mostra usuário');
assert.equal(detail.rq092Corrections[0].justification, 'Correção de data do exame.', 'log mostra justificativa');
assert.deepEqual(detail.rq092Corrections[0].changes.map((change) => change.fieldName), ['dataExame'], 'log mostra apenas campos alterados registrados');

console.log('rq092-requester-correction tests passed');
