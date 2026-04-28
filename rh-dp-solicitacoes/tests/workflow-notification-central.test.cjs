const assert = require('node:assert/strict')
const {
  composeFinalWorkflowRecipients,
  buildWorkflowRecipientsDiagnostics,
} = require('../src/lib/workflowNotificationDiagnostics.ts')

const departmentUsers = [
  { id: 'u1', fullName: 'RH 1', email: 'rh@empresa.com' },
  { id: 'u2', fullName: 'RH 2', email: 'rh2@empresa.com' },
]
const approverUsers = [{ id: 'u3', fullName: 'Gestor', email: 'gestor@empresa.com' }]

const recipients = composeFinalWorkflowRecipients({
  fixedEmails: ['fixo@empresa.com'],
  departmentUsers,
  approverUsers,
  adminEmails: ['admin@empresa.com', 'admin@empresa.com'],
  requester: 'solicitante@empresa.com',
})

assert.deepEqual(recipients, [
  'fixo@empresa.com',
  'rh@empresa.com',
  'rh2@empresa.com',
  'gestor@empresa.com',
  'admin@empresa.com',
  'solicitante@empresa.com',
])

const diagSemDest = buildWorkflowRecipientsDiagnostics(
  { kind: 'DEPARTAMENTO', notificationChannels: { notifyDepartment: true } },
  {
    departmentUsers: [],
    approverUsers: [],
    requester: null,
    fixedEmails: [],
    adminEmails: [],
    finalRecipients: [],
    approverIds: [],
    accessRule: { moduleKey: 'solicitacoes', minLevel: 'NIVEL_3' },
  },
)
assert.equal(diagSemDest.hasFinalRecipients, false)
assert.ok(diagSemDest.warnings.length > 0)
assert.ok(diagSemDest.errors.length > 0)

const diagSemAprovador = buildWorkflowRecipientsDiagnostics(
  { kind: 'APROVACAO', notificationChannels: { notifyApprover: true } },
  {
    departmentUsers: [],
    approverUsers: [],
    requester: null,
    fixedEmails: [],
    adminEmails: [],
    finalRecipients: ['fixo@empresa.com'],
    approverIds: [],
    accessRule: { moduleKey: 'solicitacoes', minLevel: 'NIVEL_3' },
  },
)
assert.equal(diagSemAprovador.hasApprovers, false)
assert.ok(diagSemAprovador.errors.some((item) => item.includes('aprovação')))

console.info('workflow-notification-central.test.cjs: ok')
