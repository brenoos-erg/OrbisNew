const assert = require('node:assert/strict')
const { isSolicitacaoEquipamento, isSolicitacaoManutencaoTi } = require('../src/lib/solicitationTypes.ts')

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

assert.equal(
  isSolicitacaoEquipamento({ codigo: 'RQ.TI.003', nome: 'Equipamentos, telefonia e recursos de TI' }),
  true,
  'RQ.TI.003 deve ser tratado como solicitação de equipamento TI',
)

assert.equal(
  isSolicitacaoManutencaoTi({ codigo: 'RQ.TI.003', nome: 'Equipamentos, telefonia e recursos de TI' }),
  false,
  'RQ.TI.003 não deve ser tratado como manutenção de TI',
)

assert.equal(
  isSolicitacaoManutencaoTi({ id: 'RQ_TI_MANUTENCAO', nome: 'Manutenção de TI' }),
  true,
  'Tipo explícito de manutenção de TI deve retornar true',
)

assert.equal(
  isSolicitacaoManutencaoTi({ nome: 'Manutenção de equipamento ou sistema de TI' }),
  true,
  'Nome específico de manutenção de TI deve retornar true',
)

console.info('solicitation-types.test.cjs: ok')