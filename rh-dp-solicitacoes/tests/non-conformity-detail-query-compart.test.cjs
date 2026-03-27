const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('src/app/api/sst/nao-conformidades/[id]/route.ts', 'utf8')

assert.match(route, /planoDeAcao:\s*\{[\s\S]*?select:\s*\{[\s\S]*?id:\s*true/)
assert.match(route, /planoDeAcao:[\s\S]*?responsavelNome:\s*true/)
assert.match(route, /planoDeAcao:[\s\S]*?prazo:\s*true/)
assert.match(route, /planoDeAcao:[\s\S]*?status:\s*true/)
assert.match(route, /planoDeAcao:[\s\S]*?evidencias:\s*true/)

assert.doesNotMatch(route, /planoDeAcao:[\s\S]*?motivoBeneficio:\s*true/)
assert.doesNotMatch(route, /planoDeAcao:[\s\S]*?atividadeComo:\s*true/)
assert.doesNotMatch(route, /planoDeAcao:[\s\S]*?centroImpactadoId:\s*true/)
assert.doesNotMatch(route, /planoDeAcao:[\s\S]*?centroResponsavelId:\s*true/)
assert.doesNotMatch(route, /planoDeAcao:[\s\S]*?centroImpactado:\s*\{/)
assert.doesNotMatch(route, /planoDeAcao:[\s\S]*?centroResponsavel:\s*\{/) 

console.log('non-conformity-detail-query-compat ok')