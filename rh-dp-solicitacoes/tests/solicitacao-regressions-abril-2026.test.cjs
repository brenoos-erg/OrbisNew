const assert = require('node:assert/strict')
const fs = require('node:fs')

const visibilitySource = fs.readFileSync('src/lib/solicitationVisibility.ts', 'utf8')
assert.match(visibilitySource, /\{\s*solicitanteId:\s*input\.userId\s*\}/)
assert.match(visibilitySource, /if \(solicitation\.solicitanteId === input\.userId\) return true/)

const createRouteSource = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
assert.match(createRouteSource, /previstoContrato/)
assert.match(createRouteSource, /Preencha o campo obrigatório "Previsto em contrato/)

const fluxoSource = fs.readFileSync('src/app/api/solicitacoes/fluxo\/\[id\]\/route.ts', 'utf8')
assert.match(fluxoSource, /tx\.solicitacaoSetor\.upsert/)
assert.match(fluxoSource, /isSolicitacaoNadaConsta/)

const seedSource = fs.readFileSync('prisma/seed.ts', 'utf8')
assert.match(seedSource, /RQ\.RH\.063/)
assert.match(seedSource, /RQ\.SST\.092/)
assert.match(seedSource, /RQ\.SST\.043/)

console.log('✅ solicitacao-regressions-abril-2026.test passed')
