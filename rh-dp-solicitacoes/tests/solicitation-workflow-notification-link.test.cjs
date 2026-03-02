const assert = require('node:assert/strict')
const { buildWorkflowNotificationPath } = require('../src/lib/workflowNotificationLink.ts')

assert.equal(
  buildWorkflowNotificationPath('APROVACAO', 'abc-123'),
  '/dashboard/solicitacoes/aprovacao?solicitationId=abc-123',
)

assert.equal(
  buildWorkflowNotificationPath('DEPARTAMENTO', 'abc-123'),
  '/dashboard/solicitacoes/abc-123',
)

assert.equal(
  buildWorkflowNotificationPath('APROVACAO', 'abc 123'),
  '/dashboard/solicitacoes/aprovacao?solicitationId=abc%20123',
)

console.info('solicitation-workflow-notification-link.test.cjs: ok')