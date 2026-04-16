const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('src/app/api/sst/nao-conformidades/[id]/estudo-causa/route.ts', 'utf8')

assert.match(route, /const hasCausaRaiz = body\?\.causaRaiz !== undefined/)
assert.match(route, /const hasItems = Array\.isArray\(body\?\.items\)/)
assert.match(route, /if \(hasItems\) {\s*await tx\.nonConformityCauseItem\.deleteMany/s)
assert.match(route, /if \(hasCausaRaiz\) {\s*await tx\.nonConformity\.update/s)

console.log('non-conformity-cause-study-safe-update ok')
