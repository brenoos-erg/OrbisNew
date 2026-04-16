const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('src/app/api/sst/nao-conformidades/[id]/route.ts', 'utf8')

assert.match(route, /const canUpdateNc = await canFeature\(me\.id, MODULE_KEYS\.SST, FEATURE_KEYS\.SST\.NAO_CONFORMIDADES, Action\.UPDATE\)/)
assert.match(route, /canEditFirstScreen: canManageAllNc\(level\) && canUpdateNc/)

console.log('non-conformity-detail-edit-visibility behavior ok')
