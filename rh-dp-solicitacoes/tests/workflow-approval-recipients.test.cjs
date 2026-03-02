const assert = require('node:assert/strict')
const { resolveApprovalRecipientId } = require('../src/lib/solicitationApproverRules.ts')

assert.equal(
  resolveApprovalRecipientId({ solicitationApproverId: 'principal', fallbackTipoApproverId: 'backup1' }),
  'principal',
)
assert.equal(
  resolveApprovalRecipientId({ solicitationApproverId: null, fallbackTipoApproverId: 'backup1' }),
  'backup1',
)
assert.equal(resolveApprovalRecipientId({ solicitationApproverId: null, fallbackTipoApproverId: null }), null)

console.info('workflow-approval-recipients.test.cjs: ok')