const assert = require('node:assert/strict')
const { resolveEquipmentApprovalMode } = require('../src/lib/solicitationApproverRules.ts')

assert.equal(
  resolveEquipmentApprovalMode({ approverId: 'user-123' }),
  'APPROVAL',
  'quando existir aprovador, SEM_ESTOQUE deve seguir para aprovação',
)

assert.equal(
  resolveEquipmentApprovalMode({ approverId: null }),
  'TI_QUEUE',
  'sem aprovador, SEM_ESTOQUE deve permanecer em tratativa com TI',
)

assert.equal(
  resolveEquipmentApprovalMode({}),
  'TI_QUEUE',
  'sem payload de aprovador, SEM_ESTOQUE deve permanecer em tratativa com TI',
)

console.info('equipment-approval-fallback.test.cjs: ok')
