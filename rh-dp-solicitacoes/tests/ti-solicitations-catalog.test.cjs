const assert = require('node:assert/strict')
const fs = require('node:fs')

const seedSource = fs.readFileSync('prisma/seed.ts', 'utf8')
for (const code of ['RQ.TI.001', 'RQ.TI.002', 'RQ.TI.003', 'RQ.TI.004', 'RQ.TI.005', 'RQ.TI.006', 'RQ.TI.007']) {
  assert.match(seedSource, new RegExp(code.replace(/\./g, '\\.'), 'g'), `${code} deve existir no seed`)
}

assert.match(seedSource, /departamentos:\s*\[tiDepartment\.id\]/)
assert.doesNotMatch(seedSource, /RQ_TI_MANUTENCAO/)
assert.doesNotMatch(seedSource, /RQ_TI_ACESSO_SISTEMA/)
assert.match(seedSource, /tipoSolicitacaoRecurso/)
assert.match(seedSource, /VPN\/Acesso remoto/)
assert.match(seedSource, /Wi-Fi/)
assert.match(seedSource, /Erro\/Bug/)
assert.match(seedSource, /Nova funcionalidade/)

const routeSource = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
assert.match(routeSource, /resolveTiRequiresApprovalByPayload/)
assert.match(routeSource, /computeTiDueDate/)

const tiRouteSource = fs.readFileSync('src/app/api/solicitacoes/ti/route.ts', 'utf8')
assert.match(tiRouteSource, /canAccessTiOperationalPanel/)
assert.match(tiRouteSource, /Ação executada: \$\{action\}/)
assert.match(tiRouteSource, /rows:\s*rows\.map/)

console.log('✅ ti-solicitations-catalog.test passed')
