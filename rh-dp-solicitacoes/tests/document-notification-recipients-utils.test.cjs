const assert = require('node:assert/strict')
const { normalizeAndValidateEmails } = require('../src/lib/documents/documentNotificationRecipients.utils.ts')

const normalized = normalizeAndValidateEmails([
  'autor@empresa.com',
  'AUTOR@empresa.com ',
  'invalido',
  '',
  ' qualidade@empresa.com',
])

assert.deepEqual(normalized, ['autor@empresa.com', 'qualidade@empresa.com'])

console.info('document-notification-recipients-utils.test.cjs: ok')
