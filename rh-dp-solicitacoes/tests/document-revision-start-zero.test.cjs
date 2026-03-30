const assert = require('node:assert/strict')

const { resolveInitialRevisionNumber } = require('../src/lib/isoDocumentCreation')

assert.equal(resolveInitialRevisionNumber(undefined), 0)
assert.equal(resolveInitialRevisionNumber(null), 0)
assert.equal(resolveInitialRevisionNumber(0), 0)
assert.equal(resolveInitialRevisionNumber(3), 3)
assert.equal(resolveInitialRevisionNumber(-1), 0)
assert.equal(resolveInitialRevisionNumber(2.5), 0)
assert.equal(resolveInitialRevisionNumber('1'), 1)

console.log('document-revision-start-zero behavior ok')