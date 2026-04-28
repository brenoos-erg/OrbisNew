const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('src/app/api/sst/nao-conformidades/[id]/route.ts', 'utf8')

assert.match(route, /centroQueDetectouId[\s\S]*centroQueOriginouId/)
assert.match(route, /error:\s*'Centro de custo inválido\.'/)
assert.match(route, /prisma\.costCenter\.findUnique\(/)
assert.match(route, /Centro que detectou alterado de/)
assert.match(route, /Centro que originou alterado de/)
assert.match(route, /data:\s*\{[\s\S]*centroQueDetectouId,[\s\S]*centroQueOriginouId,[\s\S]*prazoAtendimento,/)

console.log('non-conformity-detail-centers-edit ok')
