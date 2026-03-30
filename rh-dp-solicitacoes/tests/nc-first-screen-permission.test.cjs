const assert = require('node:assert/strict')

const { canEditFirstScreen, isEditingFirstScreen } = require('../src/lib/sst/nonConformityPermissions')

assert.equal(isEditingFirstScreen(['causaRaiz']), false)
assert.equal(isEditingFirstScreen(['descricao']), true)

assert.equal(canEditFirstScreen(false, ['descricao']), false)
assert.equal(canEditFirstScreen(false, ['causaRaiz']), true)
assert.equal(canEditFirstScreen(true, ['descricao', 'causaRaiz']), true)

console.log('nc-first-screen-permission behavior ok')