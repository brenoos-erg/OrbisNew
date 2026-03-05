const assert = require('node:assert/strict')
const { isSolicitacaoEquipamento } = require('../src/lib/solicitationTypes.ts')

assert.equal(
  isSolicitacaoEquipamento({ id: 'RQ_089', nome: 'Qualquer nome' }),
  true,
  'RQ_089 deve ser tratado como solicitação de equipamento TI',
)

assert.equal(
  isSolicitacaoEquipamento({ nome: 'Solicitação de equipamento' }),
  true,
  'Nome exato de equipamento TI deve retornar true',
)

assert.equal(
  isSolicitacaoEquipamento({ id: 'RQ_LOG_EQUIPAMENTOS', nome: 'Solicitação de equipamentos' }),
  false,
  'RQ_LOG_EQUIPAMENTOS não deve ser tratado como solicitação de equipamento TI',
)

assert.equal(
  isSolicitacaoEquipamento({ nome: 'Solicitação de equipamentos' }),
  false,
  'Nome plural não deve ser tratado como solicitação de equipamento TI',
)

console.info('solicitation-types.test.cjs: ok')