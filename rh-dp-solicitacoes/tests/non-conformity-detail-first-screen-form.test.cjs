const assert = require('node:assert/strict')
const fs = require('node:fs')

const client = fs.readFileSync('src/app/dashboard/sst/nao-conformidades/[id]/NaoConformidadeDetailClient.tsx', 'utf8')

assert.match(client, /fetch\('\/api\/cost-centers\/select'/)
assert.match(client, /centroQueDetectouId/)
assert.match(client, /centroQueOriginouId/)
assert.match(client, /Selecione centros de custo válidos para salvar\./)
assert.match(client, /body:\s*JSON\.stringify\(\{[\s\S]*centroQueDetectouId:[\s\S]*centroQueOriginouId:/)
assert.match(client, /Não foi possível carregar os centros de custo para edição\./)

console.log('non-conformity-detail-first-screen-form ok')
