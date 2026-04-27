const assert = require('node:assert/strict')
const { getStatusPresentation } = require('../src/lib/solicitationStatusPresentation.ts')

assert.equal(
  getStatusPresentation('ABERTA').label,
  'Aguardando atendimento',
  'ABERTA deve exibir label amigável de atendimento pendente.',
)

assert.equal(
  getStatusPresentation('EM_ATENDIMENTO').label,
  'Em atendimento',
  'EM_ATENDIMENTO deve exibir label amigável.',
)

assert.equal(
  getStatusPresentation('AGUARDANDO_APROVACAO').label,
  'Aguardando aprovação',
  'AGUARDANDO_APROVACAO deve exibir label amigável.',
)

assert.equal(
  getStatusPresentation('CANCELADA').label,
  'Cancelada',
  'CANCELADA deve exibir label amigável.',
)

const unknown = getStatusPresentation('STATUS_TOTALMENTE_NOVO')
assert.equal(unknown.label, 'Status Totalmente Novo', 'Status desconhecido deve ser normalizado sem quebrar.')

console.log('solicitation-status-presentation.test.cjs: ok')
