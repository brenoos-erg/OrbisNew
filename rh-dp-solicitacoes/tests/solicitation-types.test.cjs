const assert = require('node:assert/strict')
const {
  getNadaConstaPendingSectors,
  isNadaConstaAllSectorsCompleted,
  isSolicitacaoEquipamento,
  isSolicitacaoManutencaoTi,
  isSolicitacaoNadaConsta,
} = require('../src/lib/solicitationTypes.ts')

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

assert.equal(
  isSolicitacaoNadaConsta({ codigo: 'RQ.016', nome: 'Nada Consta' }),
  true,
  'RQ.016 deve ser tratado como Nada Consta',
)

const setoresNadaConstaConcluidos = [
  { setor: 'DP', status: 'CONCLUIDO', constaFlag: true },
  { setor: 'TI', status: 'CONCLUIDO', constaFlag: 'NADA_CONSTA' },
  { setor: 'ALMOX', status: 'CONCLUIDO', constaFlag: 'CONSTA' },
  { setor: 'LOGISTICA', status: 'CONCLUIDO', constaFlag: 'CIENTE' },
  { setor: 'SST', status: 'CONCLUIDO', constaFlag: 'true' },
  { setor: 'SAUDE', status: 'CONCLUIDO', constaFlag: 'CIENTE' },
  { setor: 'FINANCEIRO', status: 'CONCLUIDO', constaFlag: 'CONSTA' },
  { setor: 'FISCAL', status: 'CONCLUIDO', constaFlag: 'NADA CONSTA' },
]
assert.equal(
  isNadaConstaAllSectorsCompleted(setoresNadaConstaConcluidos),
  true,
  'Todos os setores concluídos e com constaFlag válido devem liberar finalização global',
)


const setoresNadaConstaComTiAusente = setoresNadaConstaConcluidos.filter(
  (setor) => setor.setor !== 'TI',
)

assert.equal(
  isNadaConstaAllSectorsCompleted(setoresNadaConstaComTiAusente),
  false,
  'Setor oficial ausente deve impedir finalização global',
)

assert.deepEqual(
  getNadaConstaPendingSectors(setoresNadaConstaComTiAusente),
  ['Tecnologia da Informação'],
  'Setor oficial ausente deve aparecer como pendente',
)

assert.equal(
  isNadaConstaAllSectorsCompleted([]),
  false,
  'Lista vazia de setores deve impedir finalização global',
)

assert.deepEqual(
  getNadaConstaPendingSectors([]),
  [
    'Departamento Pessoal',
    'Tecnologia da Informação',
    'Almoxarifado',
    'Logística',
    'SST',
    'Saúde',
    'Financeiro',
    'Fiscal',
  ],
  'Lista vazia deve marcar todos os setores oficiais como pendentes',
)

assert.deepEqual(
  getNadaConstaPendingSectors([
    ...setoresNadaConstaConcluidos.filter((setor) => setor.setor !== 'TI'),
    { setor: 'TI', status: 'PENDENTE', constaFlag: 'NADA_CONSTA' },
  ]),
  ['Tecnologia da Informação'],
  'Setor sem status CONCLUIDO deve aparecer como pendente',
)

console.info('solicitation-types.test.cjs: ok')