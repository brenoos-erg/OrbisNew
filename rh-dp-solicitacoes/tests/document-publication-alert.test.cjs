const assert = require('node:assert/strict')

const { buildDocumentPublicationRecipientWhere } = require('../src/lib/isoDocumentNotificationRules')

const where = buildDocumentPublicationRecipientWhere('dept-1')
assert.equal(where.status, 'ATIVO')
assert.ok(Array.isArray(where.OR))
assert.deepEqual(where.OR[0], { role: 'ADMIN' })
assert.deepEqual(where.OR[1], { departmentId: 'dept-1' })
assert.deepEqual(where.OR[2], { userDepartments: { some: { departmentId: 'dept-1' } } })

const moduleAccessClause = where.OR[3]
assert.deepEqual(moduleAccessClause.moduleAccesses.some.module.key.in, ['controle-documentos', 'meus-documentos'])
assert.deepEqual(moduleAccessClause.moduleAccesses.some.level.in, ['NIVEL_1', 'NIVEL_2', 'NIVEL_3'])

console.log('document-publication-alert behavior ok')