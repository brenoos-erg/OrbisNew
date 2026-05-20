const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('src/app/api/sst/nao-conformidades/[id]/estudo-causa/route.ts', 'utf8')
assert.match(route, /payload\?\.fiveWhys/, 'rota deve aceitar payload fiveWhys')
assert.match(route, /payload\?\.whyAnalysis/, 'rota deve aceitar payload whyAnalysis')
assert.match(route, /payload\?\.\[`porque\$\{idx \+ 1\}`\]/, 'rota deve aceitar payload legado porque1..porque5')
assert.match(route, /rootCauseAnalysis/, 'rota deve persistir rootCauseAnalysis')
assert.match(route, /ok:\s*true/, 'rota deve responder ok=true no sucesso')
assert.match(route, /Erro ao salvar estudo de causa\./, 'rota deve manter mensagem de erro padrão')

console.info('nonconformity-estudo-causa-contract.test.cjs: ok')
