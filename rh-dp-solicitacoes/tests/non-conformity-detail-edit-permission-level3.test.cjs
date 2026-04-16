const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('src/app/api/sst/nao-conformidades/[id]/route.ts', 'utf8')

assert.match(route, /canFeature\(me\.id,\s*MODULE_KEYS\.SST,\s*FEATURE_KEYS\.SST\.NAO_CONFORMIDADES,\s*Action\.UPDATE\)/)
assert.match(route, /const hasSgiQualidadeLevel3 = hasMinLevel\(level,\s*ModuleLevel\.NIVEL_3\)/)
assert.match(route, /canEditFirstScreen:\s*hasSgiQualidadeLevel3\s*&&\s*canUpdateNc/)

console.log('non-conformity-detail-edit-permission-level3 ok')
