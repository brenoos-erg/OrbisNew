const assert = require('node:assert/strict')
const { renderDocumentNotificationTemplate } = require('../src/lib/documents/documentNotificationTemplate.ts')

const rendered = renderDocumentNotificationTemplate('Documento {documentCode} - {documentTitle}', {
  documentCode: 'PO-001',
  documentTitle: 'Procedimento Operacional',
})

assert.equal(rendered, 'Documento PO-001 - Procedimento Operacional')

console.info('document-notification-template.test.cjs: ok')
