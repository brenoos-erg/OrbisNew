const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('src/app/api/sst/nao-conformidades/[id]/estudo-causa/route.ts', 'utf8')

assert.match(route, /normalizeCauseStudyPayload/, 'deve normalizar múltiplos formatos de payload')
assert.match(route, /payload\?\.\[`porque\$\{idx \+ 1\}`\]/, 'deve aceitar payload legado porque1..porque5')
assert.match(route, /questions\.length > 0 \|\| answers\.length > 0/, 'deve aceitar arrays questions\/answers')
assert.match(route, /if \(normalized\.hasItems\) {\s*await tx\.nonConformityCauseItem\.deleteMany/s)
assert.match(route, /causaRaiz: normalizedRootCause/, 'deve salvar causa raiz normalizada')
assert.match(route, /message: 'Estudo de causa atualizado\.'/, 'deve registrar timeline de estudo de causa')

console.log('non-conformity-cause-study-safe-update ok')
